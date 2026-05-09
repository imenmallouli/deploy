"""
MQTT Gateway: AutoPi Cloud → Auto Diagnostic Platform API

This bridge subscribes to AutoPi's native MQTT topic structure
(published by the MQTT Returner configured in AutoPi Cloud portal) and
forwards incoming messages to the local backend REST API.

AutoPi native topics (set via Device > Advanced Settings > MQTT > Returner):
  obd/#          → OBD-II PID loggers  (@t = obd.<name>)
  spm/bat        → Battery / voltage   (@t = obd.bat or spm.battery)
  track/pos      → GPS position        (@t = track.pos)
  acc/xyz        → Accelerometer       (@t = acc.xyz)
  reactor        → Device events       (@t = event.*)
  rpi/temp       → Device temperature  (@t = rpi.temp)

AutoPi payload format:
  { "@t": "<type>", "@ts": "2024-01-01T00:00:00Z", <fields…> }

Run example:
  python mqtt_gateway.py \\
    --mqtt-host broker.emqx.io --mqtt-port 1883 \\
    --vehicle-id 1 --autopi-device-id c917fc1199ff \\
    --email you@example.com --password yourpass
"""

import argparse
import importlib
import json
import math
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional


def _load_requests_module() -> Any:
    try:
        return importlib.import_module("requests")
    except Exception as exc:
        raise RuntimeError("Dependency missing: install requests (pip install requests)") from exc


def _load_mqtt_module() -> Any:
    try:
        return importlib.import_module("paho.mqtt.client")
    except Exception as exc:
        raise RuntimeError("Dependency missing: install paho-mqtt (pip install paho-mqtt)") from exc


# ---------------------------------------------------------------------------
# Mapping: AutoPi @t type prefix → telemetry field name
# ---------------------------------------------------------------------------
_OBD_TELEMETRY_MAP = {
    "obd.rpm":          "rpm",
    "obd.speed":        "speed",
    "obd.fuel":         "fuel_level",
    "obd.fuel_level":   "fuel_level",
    "obd.coolant":      "engine_temp",
    "obd.coolant_temp": "engine_temp",
    "obd.engine_temp":  "engine_temp",
    "obd.bat":          "battery_voltage",
    "obd.battery":      "battery_voltage",
    "spm.battery":      "battery_voltage",
    "obd.battery_charge_level": "battery_charge_level",
    "obd.nominal_voltage": "nominal_voltage",
    "obd.engine_load":  "engine_load",
    "obd.load":         "engine_load",
    "obd.ambient_air_temp": "ambient_air_temp",
    "obd.ambient_temp": "ambient_air_temp",
    "obd.ambiant_air_temp": "ambient_air_temp",
    "obd.ambiant_temp": "ambient_air_temp",
    "obd.intake_temp":  "intake_temp",
    "obd.intake_air_temp": "intake_temp",
    "obd.odometer":     "odometer",
    # Common AutoPi/OBD aliases
    "obd.vehicle_speed": "speed",
    "obd.fuel_tank_level_input": "fuel_level",
    "obd.ambient_air_temperature": "ambient_air_temp",
    "obd.ambiant_air_temperature": "ambient_air_temp",
}

_GENERIC_TELEMETRY_FALLBACK_KEYS = {
    "speed": ["speed", "sog", "speed_over_ground"],
    "track_altitude": ["track_altitude", "altitude", "alt", "elevation"],
    "course_over_ground": ["course_over_ground", "course", "cog", "heading"],
    "satellites_used": ["satellites_used", "satellites", "sats", "nsat", "satellites_used_gps"],
    "glonass_satellites_used": ["glonass_satellites_used", "glonass_satellites", "glonass", "satellites_used_glonass"],
    "temp_cpu": ["temp_cpu", "cpu_temp", "temperature_cpu", "cpu_temperature"],
    "cpu": ["cpu", "cpu_usage", "cpu_load"],
    "gpu": ["gpu", "gpu_usage", "gpu_load", "gpu_temp"],
}

# @t prefixes that indicate a DTC fault code record
_DTC_TYPE_PREFIXES = (
    "obd.dtc",
    "obd.fault",
    "obd.trouble",
    "obd.get_dtc",
    "obd.diagnostic",
    "obd.mode03",
    "obd.mode_03",
    "obd.error",
)

_DTC_HINT_KEYWORDS = (
    "dtc",
    "trouble",
    "fault",
    "mode03",
    "mode_03",
    "diagnostic",
    "get_dtc",
    "error_code",
)

# @t prefixes that indicate the payload contains raw DTC codes list
_DTC_CODES_KEY = "codes"  # AutoPi may return {"codes": ["P0300", ...], "@t": "obd.dtc", ...}


class ApiClient:
    def __init__(self, base_url: str, token: str, email: str | None = None, password: str | None = None):
        requests = _load_requests_module()
        self.base_url = base_url.rstrip("/")
        self._requests = requests
        self._email = email
        self._password = password
        self._vehicles_cache: list[dict[str, Any]] = []
        self._vehicles_cache_ts = 0.0
        self._devices_cache: list[dict[str, Any]] = []
        self._devices_cache_ts = 0.0
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        )

    def _refresh_token(self) -> bool:
        if not self._email or not self._password:
            return False
        try:
            token = login_and_get_token(self.base_url, self._email, self._password)
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            print("[API] Token refreshed after 401")
            return True
        except Exception as exc:
            print(f"[API] Token refresh failed: {exc}")
            return False

    def _post_with_retry(self, path: str, payload: dict):
        url = f"{self.base_url}{path}"
        response = self.session.post(url, json=payload, timeout=10)

        if response.status_code == 401 and self._refresh_token():
            response = self.session.post(url, json=payload, timeout=10)

        response.raise_for_status()
        return response.json()

    def _get_with_retry(self, path: str, params: dict | None = None):
        url = f"{self.base_url}{path}"
        response = self.session.get(url, params=params, timeout=10)

        if response.status_code == 401 and self._refresh_token():
            response = self.session.get(url, params=params, timeout=10)

        response.raise_for_status()
        return response.json()

    def list_vehicles(self, force_refresh: bool = False, cache_ttl_sec: int = 20) -> list[dict[str, Any]]:
        now = time.time()
        if not force_refresh and self._vehicles_cache and (now - self._vehicles_cache_ts) < cache_ttl_sec:
            return self._vehicles_cache

        payload = self._get_with_retry("/api/v1/vehicles") or {}
        self._vehicles_cache = payload.get("items") or []
        self._vehicles_cache_ts = now
        return self._vehicles_cache

    def list_devices(self, force_refresh: bool = False, cache_ttl_sec: int = 20) -> list[dict[str, Any]]:
        now = time.time()
        if not force_refresh and self._devices_cache and (now - self._devices_cache_ts) < cache_ttl_sec:
            return self._devices_cache

        payload = self._get_with_retry("/api/v1/devices") or {}
        self._devices_cache = payload.get("items") or []
        self._devices_cache_ts = now
        return self._devices_cache

    def resolve_vehicle_id(self, candidates: list[str], fallback_vehicle_id: int | None = None) -> int | None:
        """Resolve platform vehicle id by dongle/autopi aliases.

        Matching checks vehicle fields: dongle_id, autopi_device_id, autopi_unit_id.
        """
        normalized = [str(item).strip() for item in candidates if str(item).strip()]
        if not normalized:
            return fallback_vehicle_id

        candidate_set = {item.lower() for item in normalized}
        vehicles = self.list_vehicles()

        for vehicle in vehicles:
            aliases = [
                vehicle.get("dongle_id"),
                vehicle.get("autopi_device_id"),
                vehicle.get("autopi_unit_id"),
            ]
            for alias in aliases:
                if alias and str(alias).strip().lower() in candidate_set:
                    try:
                        return int(vehicle.get("id"))
                    except (TypeError, ValueError):
                        continue

        # Also resolve through Mongo devices mapping (platform linking from Devices page).
        devices = self.list_devices()
        for device in devices:
            device_aliases = [
                device.get("device_id"),
                *(device.get("aliases") or []),
            ]
            vehicle_id = device.get("vehicle_id")
            for alias in device_aliases:
                if alias and str(alias).strip().lower() in candidate_set:
                    try:
                        return int(vehicle_id)
                    except (TypeError, ValueError):
                        continue

        # Refresh cache once before giving up in case fleet mapping changed recently.
        vehicles = self.list_vehicles(force_refresh=True)
        for vehicle in vehicles:
            aliases = [
                vehicle.get("dongle_id"),
                vehicle.get("autopi_device_id"),
                vehicle.get("autopi_unit_id"),
            ]
            for alias in aliases:
                if alias and str(alias).strip().lower() in candidate_set:
                    try:
                        return int(vehicle.get("id"))
                    except (TypeError, ValueError):
                        continue

        devices = self.list_devices(force_refresh=True)
        for device in devices:
            device_aliases = [
                device.get("device_id"),
                *(device.get("aliases") or []),
            ]
            vehicle_id = device.get("vehicle_id")
            for alias in device_aliases:
                if alias and str(alias).strip().lower() in candidate_set:
                    try:
                        return int(vehicle_id)
                    except (TypeError, ValueError):
                        continue

        return fallback_vehicle_id

    def post_telemetry(self, payload: dict):
        return self._post_with_retry("/api/v1/telemetry", payload)

    def post_dtc(self, payload: dict):
        return self._post_with_retry("/api/v1/dtc", payload)

    def post_iot_log(self, payload: dict):
        return self._post_with_retry("/api/v1/dtc/iot/logs", payload)

    def post_vehicle_position(self, vehicle_id: int, latitude: float, longitude: float, speed: float | None = None):
        payload = {"vehicle_id": vehicle_id, "latitude": latitude, "longitude": longitude}
        if speed is not None:
            payload["speed"] = speed
        try:
            return self._post_with_retry("/api/v1/geofences/vehicle-positions", payload)
        except Exception as exc:
            print(f"[API] post_vehicle_position failed: {exc}")
            return {}


class MqttGateway:
    """
    AutoPi-native MQTT bridge.

    Two modes:
    - AutoPi mode (default): subscribes to AutoPi's native topics
      (obd/#, spm/bat, track/pos, acc/xyz, reactor, rpi/temp).
    - Legacy mode (--topic-prefix given): keeps the old custom topic
      structure (autodiag/devices/+/telemetry|dtc|heartbeat) for the
      simulator client (gateway/mqtt_client.py).
    """

    # AutoPi native topic subscriptions
    AUTOPI_TOPICS = [
        # Plain AutoPi topics
        "obd/#",
        "spm/bat",
        "track/pos",
        "acc/xyz",
        "reactor",
        "rpi/temp",
        # Device-prefixed variants often used by AutoPi Cloud / broker integrations
        "+/obd/#",
        "+/spm/bat",
        "+/track/pos",
        "+/acc/xyz",
        "+/reactor",
        "+/rpi/temp",
        "devices/+/obd/#",
        "devices/+/spm/bat",
        "devices/+/track/pos",
        "devices/+/acc/xyz",
        "devices/+/reactor",
        "devices/+/rpi/temp",
    ]

    def __init__(
        self,
        api_client: ApiClient,
        vehicle_id: int | None,
        autopi_device_id: str,
        qos: int,
        verbose: bool,
        topic_prefix: Optional[str] = None,
    ):
        self.api_client = api_client
        self.vehicle_id = vehicle_id
        self.autopi_device_id = autopi_device_id
        self.qos = qos
        self.verbose = verbose
        # Legacy mode when an explicit prefix was provided
        self.legacy_mode = bool(topic_prefix)
        self.topic_prefix = (topic_prefix or "").rstrip("/")

    # ------------------------------------------------------------------
    # MQTT callbacks
    # ------------------------------------------------------------------

    def on_connect(self, client, userdata, flags, reason_code, properties=None):
        print(f"[MQTT] Connected (code={reason_code})")

        if self.legacy_mode:
            # Old simulator topics
            for suffix in ("telemetry", "dtc", "heartbeat"):
                topic = f"{self.topic_prefix}/+/{suffix}"
                client.subscribe(topic, qos=self.qos)
                print(f"[MQTT] Subscribed (legacy): {topic}")
        else:
            # AutoPi native topics
            for topic in self.AUTOPI_TOPICS:
                client.subscribe(topic, qos=self.qos)
                print(f"[MQTT] Subscribed (AutoPi): {topic}")

    def on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None):
        print(f"[MQTT] Disconnected (code={reason_code})")

    @staticmethod
    def _fix_js_object(s: str) -> str:
        """Convert JavaScript object notation (unquoted keys/values) to valid JSON.

        AutoPi devices sometimes emit payloads like:
          {@@t:track.pos,@@ts:2026-05-08T10:00:00Z,loc:{lat:34.7,lon:10.7,sog:61}}
        which are not valid JSON.  This method adds the required double-quotes.
        """
        # Step 1 – quote unquoted keys (tokens right after { or ,)
        s = re.sub(r'(?<=[{,])(\s*)(@?[A-Za-z_][A-Za-z0-9_@.]*)(\s*:)', r'\1"\2"\3', s)

        # Step 2 – quote unquoted string values (after :, not a digit/bool/null/nested structure)
        def _quote_val(m: re.Match) -> str:
            val = m.group(1).strip()
            end = m.group(2)
            if re.match(r'^-?\d+(\.\d+)?([eE][+-]?\d+)?$', val):
                return f': {val}{end}'
            if val in ('true', 'false', 'null'):
                return f': {val}{end}'
            return f': "{val}"{end}'

        s = re.sub(r':\s*([^"\[{][^,}\]]*?)(\s*[,}\]])', _quote_val, s)

        # Step 3 – quote unquoted barewords inside arrays, e.g. [P0300,P0420]
        # Keep numbers/booleans/null as-is.
        def _quote_array_token(m: re.Match) -> str:
            lead = m.group(1)
            token = m.group(2).strip()
            tail = m.group(3)
            if re.match(r'^-?\d+(\.\d+)?([eE][+-]?\d+)?$', token):
                return f"{lead}{token}{tail}"
            if token in ('true', 'false', 'null'):
                return f"{lead}{token}{tail}"
            return f'{lead}"{token}"{tail}'

        s = re.sub(r'([\[,])\s*([A-Za-z_@][A-Za-z0-9_@.:-]*)\s*([,\]])', _quote_array_token, s)
        return s

    @staticmethod
    def _salvage_malformed_payload(topic: str, raw: str) -> dict[str, Any] | None:
        """Best-effort parser for malformed AutoPi payloads.

        Handles common broken DTC payloads like:
          {@t:obd.dtc,@ts:2026-05-08T21:30:00Z,codes:[P0300,P0420]}
        """
        text = (raw or "").strip()
        topic_l = (topic or "").lower()

        is_dtc_like = any(k in topic_l for k in ("dtc", "fault", "trouble", "mode03", "mode_03"))
        if not is_dtc_like and "obd.dtc" not in text.lower():
            return None

        codes = [c.upper() for c in re.findall(r"\b[PCBU][0-9A-Fa-f]{4}\b", text)]
        if not codes:
            return None

        ts_match = re.search(r"@ts\s*:\s*([^,}]+)", text)
        t_match = re.search(r"@t\s*:\s*([^,}]+)", text)
        ts_raw = ts_match.group(1).strip() if ts_match else ""
        t_raw = t_match.group(1).strip() if t_match else "obd.dtc"

        return {
            "@t": t_raw.strip('"\''),
            "@ts": ts_raw.strip('"\'') or datetime.now(timezone.utc).isoformat(),
            "codes": list(dict.fromkeys(codes)),
        }

    def on_message(self, client, userdata, msg):
        topic = msg.topic

        # Ignore empty payloads (e.g. retained-message deletions)
        if not msg.payload:
            return

        try:
            raw = msg.payload.decode("utf-8")
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                # Fallback: device sent JavaScript object notation (unquoted keys/values)
                fixed = MqttGateway._fix_js_object(raw)
                try:
                    payload = json.loads(fixed)
                    if self.verbose:
                        print(f"[MQTT] Fixed JS-object notation on {topic}: {fixed[:120]}")
                except json.JSONDecodeError as exc:
                    salvaged = MqttGateway._salvage_malformed_payload(topic, raw)
                    if salvaged is not None:
                        payload = salvaged
                        print(f"[MQTT] Salvaged malformed payload on {topic}: {str(salvaged)[:180]}")
                    else:
                        print(f"[MQTT] Invalid JSON on {topic}: {exc}  raw={msg.payload[:120]}  fixed={fixed[:180]}")
                        return

            # AutoPi sometimes sends an array of objects
            if isinstance(payload, list):
                for item in payload:
                    self._dispatch(topic, item)
            else:
                self._dispatch(topic, payload)
        except Exception as exc:
            print(f"[FORWARD] Error topic={topic}: {exc}")

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_value(payload: dict, fallback_keys: list[str] | None = None):
        def unwrap(value: Any):
            if value is None:
                return None
            if isinstance(value, dict):
                for key in ("value", "result", "data"):
                    if key in value:
                        nested = unwrap(value.get(key))
                        if nested is not None:
                            return nested
                return None
            return value

        if "value" in payload and payload.get("value") is not None:
            return unwrap(payload.get("value"))
        if fallback_keys:
            for key in fallback_keys:
                if payload.get(key) is not None:
                    return unwrap(payload.get(key))
        return None

    @staticmethod
    def _extract_nested_value(payload: dict, container_key: str, fallback_keys: list[str]) -> Any:
        container = payload.get(container_key)
        if not isinstance(container, dict):
            return None
        for key in fallback_keys:
            value = container.get(key)
            if value is not None:
                return value
        return None

    def _dispatch(self, topic: str, payload: dict):
        if self.legacy_mode:
            self._dispatch_legacy(topic, payload)
        else:
            self._dispatch_autopi(topic, payload)

    def _collect_device_candidates(self, topic: str, payload: dict) -> list[str]:
        candidates = []

        for key in ("device_id", "dongle_id", "autopi_device_id", "autopi_unit_id", "unit_id", "client_id"):
            value = payload.get(key)
            if value:
                candidates.append(str(value))

        if self.autopi_device_id:
            candidates.append(str(self.autopi_device_id))

        if not self.legacy_mode and "/" in topic:
            first_segment = topic.split("/", 1)[0].strip()
            if first_segment and first_segment.lower() not in {"obd", "spm", "track", "acc", "reactor", "rpi"}:
                candidates.append(first_segment)

        if self.legacy_mode and self.topic_prefix:
            legacy_device = self._legacy_extract_device_id(topic)
            if legacy_device and legacy_device != "unknown-device":
                candidates.append(legacy_device)

        # Keep order but drop duplicates
        unique = []
        seen = set()
        for item in candidates:
            key = item.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            unique.append(item.strip())
        return unique

    def _resolve_vehicle_context(self, topic: str, payload: dict) -> tuple[int | None, str | None]:
        candidates = self._collect_device_candidates(topic, payload)
        resolved_vehicle_id = self.api_client.resolve_vehicle_id(candidates, fallback_vehicle_id=self.vehicle_id)
        resolved_device_id = candidates[0] if candidates else (self.autopi_device_id or None)

        if resolved_vehicle_id is None and self.verbose:
            print(f"[SKIP] No vehicle mapping found for device candidates={candidates!r} topic={topic}")

        return resolved_vehicle_id, resolved_device_id

    @staticmethod
    def _normalize_autopi_type(raw_type: str) -> str:
        """Normalize AutoPi type names to a stable obd.* naming."""
        t = (raw_type or "").strip().lower()
        if not t:
            return ""
        if t.startswith(("obd.", "track.", "acc.", "event.", "spm.", "rpi.")):
            return t
        if t in {"pos", "track_pos", "track.position", "position", "gps_pos"}:
            return "track.pos"
        if t in {"rpi_temp", "cpu_temp", "temp_cpu"}:
            return "rpi.temp"
        # AutoPi often sends _type like "rpm", "coolant_temp", "engine_load"
        return f"obd.{t}"

    def _extract_generic_telemetry_fields(self, payload: dict) -> dict[str, Any]:
        fields: dict[str, Any] = {}
        nested_containers = ("loc", "gps", "position", "data", "result", "value")

        for metric, keys in _GENERIC_TELEMETRY_FALLBACK_KEYS.items():
            value = self._extract_value(payload, keys)
            if value is None:
                for container_key in nested_containers:
                    value = self._extract_nested_value(payload, container_key, keys)
                    if value is not None:
                        break
            if value is not None:
                fields[metric] = value

        return fields

    def _infer_type_from_topic_payload(self, topic: str, payload: dict) -> str:
        """Infer telemetry type when @t is missing in AutoPi payload."""
        at = self._normalize_autopi_type(str(payload.get("@t") or ""))
        if at:
            return at

        alt_type = self._normalize_autopi_type(str(payload.get("_type") or payload.get("type") or ""))
        if alt_type:
            return alt_type

        # Fallback from topic name (obd/rpm -> obd.rpm)
        if topic.startswith("obd/"):
            suffix = topic.split("/", 1)[1].strip().lower()
            if suffix:
                return f"obd.{suffix}"
        if topic == "spm/bat":
            return "spm.battery"
        if topic == "track/pos":
            return "track.pos"
        if topic == "acc/xyz":
            return "acc.xyz"
        if topic == "rpi/temp":
            return "rpi.temp"
        return ""

    @staticmethod
    def _normalize_telemetry_fields(fields: dict[str, Any]) -> dict[str, Any]:
        """Prepare field values for backend schema compatibility."""
        normalized: dict[str, Any] = {}
        for key, value in fields.items():
            if value is None:
                continue
            try:
                if key == "rpm":
                    v = float(value)
                    if not math.isfinite(v):
                        continue
                    normalized[key] = int(round(v))
                    continue
                if isinstance(value, (int, float)):
                    if isinstance(value, float) and not math.isfinite(value):
                        continue
                    normalized[key] = value
                    continue
                normalized[key] = value
            except (TypeError, ValueError):
                continue
        return normalized

    def _dispatch_autopi(self, topic: str, payload: dict):
        """Route an AutoPi payload to the correct API endpoint."""
        canonical_topic = self._canonical_autopi_topic(topic)
        at = self._infer_type_from_topic_payload(canonical_topic, payload)
        ts = payload.get("@ts") or payload.get("_stamp") or datetime.now(timezone.utc).isoformat()
        resolved_vehicle_id, resolved_device_id = self._resolve_vehicle_context(topic, payload)

        if resolved_vehicle_id is None:
            return

        # --- Battery / voltage ---
        if at in ("obd.bat", "spm.battery", "obd.battery") or canonical_topic == "spm/bat":
            self._forward_telemetry(
                {
                    "battery_voltage": self._extract_value(payload, ["voltage", "battery_voltage", "bat"]),
                    "battery_charge_level": self._extract_value(payload, ["battery_charge_level", "charge_level", "soc", "level", "percent"]),
                    "nominal_voltage": self._extract_value(payload, ["nominal_voltage", "nominal", "voltage_nominal", "system_voltage"]),
                },
                ts,
                topic,
                resolved_vehicle_id,
                resolved_device_id,
            )
            return

        # --- OBD PID that maps to a telemetry field ---
        if at in _OBD_TELEMETRY_MAP:
            field = _OBD_TELEMETRY_MAP[at]
            per_field_keys = {
                "fuel_level": ["fuel", "fuel_level"],
                "engine_temp": ["coolant", "coolant_temp", "engine_temp", "temp"],
                "engine_load": ["load", "engine_load"],
                "ambient_air_temp": ["ambient_air_temp", "ambient_temp", "ambiant_air_temp", "ambiant_temp", "ambient_air_temperature", "ambiant_air_temperature", "temp"],
                "intake_temp": ["intake_temp", "intake_air_temp", "temp"],
                "odometer": ["odometer", "distance"],
                "speed": ["speed"],
                "rpm": ["rpm"],
                "battery_voltage": ["voltage", "battery_voltage", "bat"],
                "battery_charge_level": ["battery_charge_level", "charge_level", "soc", "level", "percent"],
                "nominal_voltage": ["nominal_voltage", "nominal", "voltage_nominal", "system_voltage"],
            }
            value = self._extract_value(payload, per_field_keys.get(field, [field]))
            self._forward_telemetry({field: value}, ts, topic, resolved_vehicle_id, resolved_device_id)
            return

        # --- DTC fault codes (format-detection first, before generic obd.* fallback) ---
        dtc_like_type = any(at.startswith(prefix) for prefix in _DTC_TYPE_PREFIXES) or any(
            keyword in at for keyword in _DTC_HINT_KEYWORDS
        )
        dtc_like_topic = any(keyword in canonical_topic.lower() for keyword in ("dtc", "trouble", "fault", "mode03", "mode_03"))
        extracted_dtc_entries = self._extract_dtc_entries(payload)
        if extracted_dtc_entries and (dtc_like_type or dtc_like_topic):
            self._handle_autopi_dtc(payload, ts, topic, resolved_vehicle_id, resolved_device_id, extracted_codes=extracted_dtc_entries)
            return

        # --- Generic obd.* PID: try to map by field name ---
        if at.startswith("obd.") and not any(at.startswith(p) for p in _DTC_TYPE_PREFIXES):
            pid_name = at[4:]  # strip "obd."
            value = payload.get("value")
            if value is not None:
                # Try direct field match in map by pid_name
                matched_field = None
                for key, field in _OBD_TELEMETRY_MAP.items():
                    if key.endswith(pid_name):
                        matched_field = field
                        break
                if matched_field:
                    self._forward_telemetry({matched_field: value}, ts, topic, resolved_vehicle_id, resolved_device_id)
                else:
                    # Unknown PID — store as IoT log so data is not lost
                    self._forward_event(
                        event_type=f"obd_pid.{pid_name}",
                        level="info",
                        message=f"{at}={value}",
                        metadata=payload,
                        ts=ts,
                        topic=topic,
                        vehicle_id=resolved_vehicle_id,
                        device_id=resolved_device_id,
                    )
                return

        # --- DTC fault codes ---
        if any(at.startswith(p) for p in _DTC_TYPE_PREFIXES):
            self._handle_autopi_dtc(payload, ts, topic, resolved_vehicle_id, resolved_device_id)
            return

        # --- GPS position ---
        if at == "track.pos" or canonical_topic == "track/pos":
            loc = payload.get("loc", {})
            if not isinstance(loc, dict):
                loc = {}
            sog_value = self._extract_value(payload, ["sog", "speed_over_ground", "speed"])
            if sog_value is None and isinstance(loc, dict):
                sog_value = loc.get("sog") or loc.get("speed")

            # Extract latitude / longitude from loc sub-object or top-level keys
            lat = (loc.get("lat") or loc.get("latitude")
                   or self._extract_value(payload, ["lat", "latitude"]))
            lon = (loc.get("lon") or loc.get("lng") or loc.get("longitude")
                   or self._extract_value(payload, ["lon", "lng", "longitude"]))

            self._forward_telemetry(
                {
                    "speed": sog_value,
                    "track_altitude": self._extract_value(payload, ["track_altitude", "alt", "altitude", "elevation"])
                    or self._extract_nested_value(payload, "loc", ["alt", "altitude", "elevation"]),
                    "course_over_ground": self._extract_value(payload, ["course_over_ground", "course", "cog", "heading"])
                    or self._extract_nested_value(payload, "loc", ["course_over_ground", "course", "cog", "heading"]),
                    "satellites_used": self._extract_value(payload, ["satellites_used", "satellites", "sats", "nsat", "satellites_used_gps"])
                    or self._extract_nested_value(payload, "loc", ["satellites_used", "satellites", "sats", "nsat"]),
                    "glonass_satellites_used": self._extract_value(payload, ["glonass_satellites_used", "glonass_satellites", "glonass", "satellites_used_glonass"])
                    or self._extract_nested_value(payload, "loc", ["glonass_satellites_used", "glonass_satellites", "glonass"]),
                },
                ts,
                topic,
                resolved_vehicle_id,
                resolved_device_id,
            )

            # Save GPS coordinates to vehicle_positions so the Locations map updates
            if lat is not None and lon is not None:
                try:
                    lat_f = float(lat)
                    lon_f = float(lon)
                    speed_f = float(sog_value) if sog_value is not None else None
                    self.api_client.post_vehicle_position(resolved_vehicle_id, lat_f, lon_f, speed_f)
                    print(f"[GPS] position saved vehicle_id={resolved_vehicle_id} lat={lat_f} lon={lon_f} speed={speed_f}")
                except (TypeError, ValueError) as exc:
                    print(f"[GPS] position parse error: {exc}")
            return

        # --- Accelerometer ---
        if at == "acc.xyz" or canonical_topic == "acc/xyz":
            self._forward_event(
                event_type="accelerometer",
                level="info",
                message=f"x={payload.get('x')} y={payload.get('y')} z={payload.get('z')}",
                metadata=payload,
                ts=ts,
                topic=topic,
                vehicle_id=resolved_vehicle_id,
                device_id=resolved_device_id,
            )
            return

        # --- Device events / reactor ---
        if at.startswith("event.") or canonical_topic == "reactor":
            tag = payload.get("@tag", at)
            level = "warning" if "error" in tag or "fault" in tag else "info"
            self._forward_event(
                event_type="device_event",
                level=level,
                message=tag,
                metadata=payload,
                ts=ts,
                topic=topic,
                vehicle_id=resolved_vehicle_id,
                device_id=resolved_device_id,
            )
            return

        # --- RPi temperature ---
        if at == "rpi.temp" or canonical_topic == "rpi/temp":
            self._forward_telemetry(
                {
                    "temp_cpu": self._extract_value(payload, ["temp_cpu", "cpu_temp", "value", "temperature"]),
                    "cpu": self._extract_value(payload, ["cpu", "cpu_usage"]),
                    "gpu": self._extract_value(payload, ["gpu", "gpu_usage", "gpu_temp"]),
                },
                ts,
                topic,
                resolved_vehicle_id,
                resolved_device_id,
            )
            self._forward_event(
                event_type="system",
                level="info",
                message=f"rpi_temp={payload.get('value')}",
                metadata=payload,
                ts=ts,
                topic=topic,
                vehicle_id=resolved_vehicle_id,
                device_id=resolved_device_id,
            )
            return

        # --- Generic fallback for non-standard AutoPi payload/topic naming ---
        generic_fields = self._extract_generic_telemetry_fields(payload)
        if generic_fields:
            self._forward_telemetry(generic_fields, ts, topic, resolved_vehicle_id, resolved_device_id)
            if self.verbose:
                print(f"[MQTT] Generic telemetry fallback matched topic={topic} fields={list(generic_fields.keys())}")
            return

        # --- Unknown ---
        if self.verbose:
            print(f"[MQTT] Unrecognised @t={at!r} topic={topic}  payload={str(payload)[:120]}")

    @staticmethod
    def _canonical_autopi_topic(topic: str) -> str:
        """Normalize AutoPi topics that may include a device prefix.

        Examples:
        - obd/rpm -> obd/rpm
        - c917fc1199ff/obd/rpm -> obd/rpm
        - devices/c917fc1199ff/track/pos -> track/pos
        """
        cleaned = (topic or "").strip().strip("/")
        if not cleaned:
            return cleaned

        if "obd/" in cleaned:
            idx = cleaned.find("obd/")
            return cleaned[idx:]

        for static_topic in ("spm/bat", "track/pos", "acc/xyz", "reactor", "rpi/temp"):
            if cleaned == static_topic or cleaned.endswith(f"/{static_topic}"):
                return static_topic

        return cleaned

    def _handle_autopi_dtc(
        self,
        payload: dict,
        ts: str,
        topic: str,
        vehicle_id: int,
        device_id: str | None,
        extracted_codes: list[dict[str, Any]] | None = None,
    ):
        """Forward AutoPi DTC data to POST /api/v1/dtc.

        AutoPi may send a single code or a list under the 'codes' key.
        """
        extracted_codes = extracted_codes if extracted_codes is not None else self._extract_dtc_entries(payload)

        if not extracted_codes:
            self.api_client.post_iot_log(
                {
                    "vehicle_id": vehicle_id,
                    "device_id": device_id or self.autopi_device_id,
                    "event_type": "dtc_unparsed",
                    "level": "warning",
                    "message": "Payload DTC AutoPi recu mais non parse",
                    "metadata": payload,
                    "event_at": ts,
                }
            )
            if self.verbose:
                print(f"[DTC] Unparsed AutoPi DTC payload topic={topic} payload={str(payload)[:200]}")
            return

        for entry in extracted_codes:
            code = entry.get("code")
            if not code:
                continue
            dtc = {
                "vehicle_id": vehicle_id,
                "device_id": device_id,
                "dongle_id": device_id,
                "autopi_device_id": device_id,
                "code": str(code),
                "description": entry.get("description") or payload.get("description", ""),
                "severity": entry.get("severity") or payload.get("severity"),
                "category": entry.get("category") or payload.get("category"),
                "recommended_action": entry.get("recommended_action") or payload.get("recommended_action"),
                "first_detected": ts,
                "last_occurrence": ts,
                "occurrence_count": entry.get("occurrence_count") or payload.get("occurrence_count"),
            }
            result = self.api_client.post_dtc(dtc)
            print(f"[FORWARD] dtc OK code={code} topic={topic} status={result.get('status', 'unknown')}")

    @staticmethod
    def _extract_dtc_entries(payload: dict) -> list[dict[str, Any]]:
        """Accept common AutoPi DTC payload variants and normalize them.

        Examples seen in the field:
        - {"codes": ["P0300", "P0420"]}
        - {"value": ["P0300", "P0420"]}
        - {"dtc_codes": ["P0300"]}
        - {"codes": [{"code": "P0300", "description": "..."}]}
        - {"stored": ["P0300"], "pending": ["P0171"]}
        - {"value": {"stored": [...], "pending": [...]}}
        - {"code": "P0300"}
        """

        dtc_code_pattern = re.compile(r"^[PCBU][0-9A-F]{4}$", re.IGNORECASE)

        def normalize_entry(item: Any, *, default_category: str | None = None) -> dict[str, Any] | None:
            if item is None:
                return None
            if isinstance(item, str):
                code = item.strip().upper()
                return {"code": code, "category": default_category} if dtc_code_pattern.fullmatch(code) else None
            if isinstance(item, dict):
                code = str(
                    item.get("code")
                    or item.get("dtc")
                    or item.get("dtc_code")
                    or item.get("value")
                    or ""
                ).strip().upper()
                if not code or not dtc_code_pattern.fullmatch(code):
                    return None
                return {
                    "code": code,
                    "description": item.get("description") or item.get("text") or item.get("message"),
                    "severity": item.get("severity") or item.get("level"),
                    "category": item.get("category") or item.get("status") or default_category,
                    "recommended_action": item.get("recommended_action") or item.get("recommendation"),
                    "occurrence_count": item.get("occurrence_count") or item.get("count"),
                }
            return None

        def collect_from_value(value: Any, *, default_category: str | None = None) -> list[dict[str, Any]]:
            collected: list[dict[str, Any]] = []
            if value is None:
                return collected
            if isinstance(value, list):
                for item in value:
                    normalized = normalize_entry(item, default_category=default_category)
                    if normalized:
                        collected.append(normalized)
                return collected
            if isinstance(value, dict):
                nested_keys = ("codes", "dtc_codes", "stored", "pending", "confirmed", "permanent", "current")
                has_nested = False
                for key in nested_keys:
                    if key in value:
                        has_nested = True
                        collected.extend(collect_from_value(value.get(key), default_category=key))
                if has_nested:
                    return collected
                normalized = normalize_entry(value, default_category=default_category)
                if normalized:
                    collected.append(normalized)
                return collected
            normalized = normalize_entry(value, default_category=default_category)
            if normalized:
                collected.append(normalized)
            return collected

        candidates: list[dict[str, Any]] = []
        for key in ("codes", "dtc_codes", "value", "result", "data", "stored", "pending", "confirmed", "permanent", "current"):
            if key in payload:
                candidates.extend(collect_from_value(payload.get(key), default_category=key if key not in {"codes", "dtc_codes", "value", "result", "data"} else None))

        if not candidates and any(payload.get(key) for key in ("code", "dtc", "dtc_code")):
            normalized = normalize_entry(payload)
            if normalized:
                candidates.append(normalized)

        # Fallback: extract DTC-like tokens from free text payload fragments.
        if not candidates:
            text_keys = ("message", "description", "result", "data", "value", "response", "raw", "text")
            raw_texts = [str(payload.get(key) or "") for key in text_keys]
            raw_texts.append(json.dumps(payload, ensure_ascii=False))
            for text in raw_texts:
                for code in re.findall(r"\b[PCBU][0-9A-Fa-f]{4}\b", text):
                    candidates.append({"code": code.upper()})

        deduped: list[dict[str, Any]] = []
        seen: set[tuple[str, str | None]] = set()
        for entry in candidates:
            code = str(entry.get("code") or "").strip().upper()
            category = str(entry.get("category") or "").strip().lower() or None
            if not code:
                continue
            key = (code, category)
            if key in seen:
                continue
            seen.add(key)
            entry["code"] = code
            deduped.append(entry)

        return deduped

    def _forward_telemetry(self, fields: dict, ts: str, topic: str, vehicle_id: int, device_id: str | None):
        """POST a partial telemetry record (merges vehicle_id and ts)."""
        # Drop invalid values and normalize for backend schema (rpm must be int).
        data = self._normalize_telemetry_fields(fields)
        if not data:
            if self.verbose:
                print(f"[SKIP] telemetry: all fields None for topic={topic}")
            return

        body = {
            "vehicle_id": vehicle_id,
            "device_id": device_id,
            "dongle_id": device_id,
            "autopi_device_id": device_id,
            "ts": ts,
            **data,
        }
        result = self.api_client.post_telemetry(body)
        field_names = ", ".join(data.keys())
        print(f"[FORWARD] telemetry OK [{field_names}] topic={topic} status={result.get('status', 'unknown')}")
        
        # Display which metrics are received (green) vs missing (yellow)
        expected_metrics = [
            "speed", "rpm", "fuel_level", "engine_temp", "battery_voltage", "battery_charge_level",
            "nominal_voltage", "engine_load", "ambient_air_temp", "intake_temp", "odometer",
            "track_altitude", "course_over_ground", "satellites_used", "glonass_satellites_used",
            "temp_cpu", "cpu", "gpu",
        ]
        received = set(data.keys())
        missing = set(expected_metrics) - received
        
        if missing:
            green = '\033[92m'
            yellow = '\033[93m'
            reset = '\033[0m'
            received_display = ', '.join(sorted(received)) if received else '(none)'
            missing_display = ', '.join(sorted(missing))
            print(f"  {green}✓ Received:{reset} {received_display}")
            print(f"  {yellow}✗ Missing:{reset} {missing_display}")

    def _forward_event(
        self,
        event_type: str,
        level: str,
        message: str,
        metadata: dict,
        ts: str,
        topic: str,
        vehicle_id: int,
        device_id: str | None,
    ):
        """POST an IoT log entry to /api/v1/dtc/iot/logs."""
        body = {
            "vehicle_id": vehicle_id,
            "device_id": device_id or self.autopi_device_id,
            "event_type": event_type,
            "level": level,
            "message": message,
            "metadata": metadata,
            "event_at": ts,
        }
        result = self.api_client.post_iot_log(body)
        print(f"[FORWARD] event OK type={event_type} topic={topic} status={result.get('status', 'unknown')}")

    # ------------------------------------------------------------------
    # Legacy mode (simulator / old custom topics)
    # ------------------------------------------------------------------

    def _dispatch_legacy(self, topic: str, payload: dict):
        device_id = self._legacy_extract_device_id(topic)

        if topic.endswith("/telemetry"):
            vehicle_id = payload.get("vehicle_id")
            if vehicle_id is None:
                raise RuntimeError("legacy telemetry payload missing vehicle_id")
            if payload.get("ts") is None:
                payload["ts"] = datetime.now(timezone.utc).isoformat()
            result = self.api_client.post_telemetry(payload)
            print(f"[FORWARD] telemetry OK topic={topic} status={result.get('status', 'unknown')}")

        elif topic.endswith("/dtc"):
            vehicle_id = payload.get("vehicle_id")
            if vehicle_id is None:
                raise RuntimeError("legacy dtc payload missing vehicle_id")
            result = self.api_client.post_dtc(payload)
            print(f"[FORWARD] dtc OK topic={topic} status={result.get('status', 'unknown')}")

        elif topic.endswith("/heartbeat"):
            status_value = str(payload.get("status", "unknown"))
            event_at = payload.get("ts") or datetime.now(timezone.utc).isoformat()
            iot_payload = {
                "vehicle_id": payload.get("vehicle_id"),
                "device_id": payload.get("device_id") or payload.get("unit_id") or device_id,
                "event_type": "heartbeat",
                "level": "info",
                "message": f"heartbeat status={status_value}",
                "metadata": payload,
                "event_at": event_at,
            }
            result = self.api_client.post_iot_log(iot_payload)
            print(f"[FORWARD] heartbeat->iot_log OK topic={topic} status={result.get('status', 'unknown')}")

        else:
            if self.verbose:
                print(f"[MQTT] Ignored legacy topic: {topic}")

    def _legacy_extract_device_id(self, topic: str) -> str:
        prefix = f"{self.topic_prefix}/"
        if not topic.startswith(prefix):
            return "unknown-device"
        parts = topic[len(prefix):].split("/")
        return parts[0] if len(parts) >= 2 else "unknown-device"


def login_and_get_token(base_url: str, email: str, password: str) -> str:
    requests = _load_requests_module()
    response = requests.post(
        f"{base_url.rstrip('/')}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json() or {}
    token = data.get("access_token")

    if not token:
        raise RuntimeError("Login succeeded but access_token not found in response")

    return token


def parse_args():
    parser = argparse.ArgumentParser(
        description="AutoPi Cloud MQTT -> Auto Diagnostic Platform API gateway",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # MQTT connection
    parser.add_argument("--mqtt-host", default="broker.emqx.io", help="MQTT broker host (default: broker.emqx.io)")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--mqtt-username", default=None, help="MQTT username (if broker requires auth)")
    parser.add_argument("--mqtt-password", default=None, help="MQTT password")
    parser.add_argument("--mqtt-keepalive", type=int, default=60, help="MQTT keepalive seconds")

    # AutoPi device → platform mapping
    parser.add_argument(
        "--vehicle-id", type=int, default=None,
        help="Fallback platform vehicle_id when device mapping is not found",
    )
    parser.add_argument(
        "--autopi-device-id", default="autopi-device",
        help="AutoPi unit_id / client ID used to tag IoT log entries (e.g. c917fc1199ff)",
    )

    # Legacy mode (simulator)
    parser.add_argument(
        "--topic-prefix", default=None,
        help="LEGACY: custom topic prefix (e.g. autodiag/devices). "
             "When omitted, uses AutoPi native topics.",
    )

    # QoS
    parser.add_argument("--qos", type=int, default=1, choices=[0, 1, 2], help="MQTT QoS level")

    # Backend API
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend API base URL")
    parser.add_argument("--token", default=None, help="Pre-existing JWT token (skips login)")
    parser.add_argument("--email", default=None, help="Email for automatic API login")
    parser.add_argument("--password", default=None, help="Password for automatic API login")

    parser.add_argument("--verbose", action="store_true", help="Log unrecognised topics and skipped messages")

    args = parser.parse_args()

    # Override with environment variables when args were not explicitly set.
    # This lets docker-compose pass config via env vars without listing every flag.
    if args.mqtt_host == "broker.emqx.io" and os.environ.get("ADP_AUTOPI_MQTT_HOST"):
        args.mqtt_host = os.environ["ADP_AUTOPI_MQTT_HOST"]
    if args.mqtt_port == 1883 and os.environ.get("ADP_AUTOPI_MQTT_PORT"):
        try:
            args.mqtt_port = int(os.environ["ADP_AUTOPI_MQTT_PORT"])
        except ValueError:
            pass
    if not args.mqtt_username and os.environ.get("ADP_AUTOPI_MQTT_USERNAME"):
        args.mqtt_username = os.environ["ADP_AUTOPI_MQTT_USERNAME"]
    if not args.mqtt_password and os.environ.get("ADP_AUTOPI_MQTT_PASSWORD"):
        args.mqtt_password = os.environ["ADP_AUTOPI_MQTT_PASSWORD"]
    if args.autopi_device_id == "autopi-device" and os.environ.get("ADP_AUTOPI_DEVICE_ID"):
        args.autopi_device_id = os.environ["ADP_AUTOPI_DEVICE_ID"]
    if args.vehicle_id is None and os.environ.get("ADP_AUTOPI_FALLBACK_VEHICLE_ID"):
        try:
            args.vehicle_id = int(os.environ["ADP_AUTOPI_FALLBACK_VEHICLE_ID"])
        except ValueError:
            pass
    if not args.verbose and os.environ.get("ADP_AUTOPI_VERBOSE", "").lower() in ("1", "true", "yes"):
        args.verbose = True

    return args


def main():
    mqtt = _load_mqtt_module()
    args = parse_args()

    # --- Authenticate ---
    token = args.token
    if not token:
        if not args.email or not args.password:
            raise RuntimeError("Provide --token OR (--email and --password)")
        token = login_and_get_token(args.base_url, args.email, args.password)
        print("[API] Token obtained via /api/v1/auth/login")

    api_client = ApiClient(
        base_url=args.base_url,
        token=token,
        email=args.email,
        password=args.password,
    )

    gateway = MqttGateway(
        api_client=api_client,
        vehicle_id=args.vehicle_id,
        autopi_device_id=args.autopi_device_id,
        qos=args.qos,
        verbose=args.verbose,
        topic_prefix=args.topic_prefix,  # None → AutoPi mode
    )

    mode = "LEGACY" if args.topic_prefix else "AutoPi"
    print(f"[CONFIG] Mode         : {mode}")
    print(f"[CONFIG] vehicle_id   : {args.vehicle_id if args.vehicle_id is not None else 'auto-resolve'}")
    print(f"[CONFIG] device_id    : {args.autopi_device_id}")
    print(f"[CONFIG] broker       : {args.mqtt_host}:{args.mqtt_port}")
    print(f"[CONFIG] backend      : {args.base_url}")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    if args.mqtt_username:
        client.username_pw_set(args.mqtt_username, args.mqtt_password)

    client.on_connect = gateway.on_connect
    client.on_message = gateway.on_message
    client.on_disconnect = gateway.on_disconnect

    print(f"[MQTT] Connecting to {args.mqtt_host}:{args.mqtt_port} ...")
    client.connect(args.mqtt_host, args.mqtt_port, args.mqtt_keepalive)

    print("[RUN] MQTT gateway started (Ctrl+C to stop)")
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[STOP] MQTT gateway stopped")


if __name__ == "__main__":
    main()
