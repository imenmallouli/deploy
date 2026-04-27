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
    "obd.engine_load":  "engine_load",
    "obd.load":         "engine_load",
    "obd.ambient_air_temp": "ambient_air_temp",
    "obd.ambient_temp": "ambient_air_temp",
    "obd.intake_temp":  "intake_temp",
    "obd.intake_air_temp": "intake_temp",
    "obd.odometer":     "odometer",
    # Common AutoPi/OBD aliases
    "obd.vehicle_speed": "speed",
    "obd.fuel_tank_level_input": "fuel_level",
    "obd.ambient_air_temperature": "ambient_air_temp",
}

# @t prefixes that indicate a DTC fault code record
_DTC_TYPE_PREFIXES = ("obd.dtc", "obd.fault", "obd.trouble")

# @t prefixes that indicate the payload contains raw DTC codes list
_DTC_CODES_KEY = "codes"  # AutoPi may return {"codes": ["P0300", ...], "@t": "obd.dtc", ...}


class ApiClient:
    def __init__(self, base_url: str, token: str, email: str | None = None, password: str | None = None):
        requests = _load_requests_module()
        self.base_url = base_url.rstrip("/")
        self._requests = requests
        self._email = email
        self._password = password
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

    def post_telemetry(self, payload: dict):
        return self._post_with_retry("/api/v1/telemetry", payload)

    def post_dtc(self, payload: dict):
        return self._post_with_retry("/api/v1/dtc", payload)

    def post_iot_log(self, payload: dict):
        return self._post_with_retry("/api/v1/dtc/iot/logs", payload)


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
        "obd/#",
        "spm/bat",
        "track/pos",
        "acc/xyz",
        "reactor",
        "rpi/temp",
    ]

    def __init__(
        self,
        api_client: ApiClient,
        vehicle_id: int,
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

    def on_message(self, client, userdata, msg):
        topic = msg.topic

        try:
            raw = msg.payload.decode("utf-8")
            payload = json.loads(raw)
            # AutoPi sometimes sends an array of objects
            if isinstance(payload, list):
                for item in payload:
                    self._dispatch(topic, item)
            else:
                self._dispatch(topic, payload)
        except json.JSONDecodeError as exc:
            print(f"[MQTT] Invalid JSON on {topic}: {exc}  raw={msg.payload[:120]}")
        except Exception as exc:
            print(f"[FORWARD] Error topic={topic}: {exc}")

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_value(payload: dict, fallback_keys: list[str] | None = None):
        if "value" in payload and payload.get("value") is not None:
            return payload.get("value")
        if fallback_keys:
            for key in fallback_keys:
                if payload.get(key) is not None:
                    return payload.get(key)
        return None

    def _dispatch(self, topic: str, payload: dict):
        if self.legacy_mode:
            self._dispatch_legacy(topic, payload)
        else:
            self._dispatch_autopi(topic, payload)

    @staticmethod
    def _normalize_autopi_type(raw_type: str) -> str:
        """Normalize AutoPi type names to a stable obd.* naming."""
        t = (raw_type or "").strip().lower()
        if not t:
            return ""
        if t.startswith("obd."):
            return t
        # AutoPi often sends _type like "rpm", "coolant_temp", "engine_load"
        return f"obd.{t}"

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
        at = self._infer_type_from_topic_payload(topic, payload)
        ts = payload.get("@ts") or payload.get("_stamp") or datetime.now(timezone.utc).isoformat()

        # --- Battery / voltage ---
        if at in ("obd.bat", "spm.battery", "obd.battery") or topic == "spm/bat":
            self._forward_telemetry(
                {"battery_voltage": self._extract_value(payload, ["voltage", "battery_voltage", "bat"])},
                ts,
                topic,
            )
            return

        # --- OBD PID that maps to a telemetry field ---
        if at in _OBD_TELEMETRY_MAP:
            field = _OBD_TELEMETRY_MAP[at]
            per_field_keys = {
                "fuel_level": ["fuel", "fuel_level"],
                "engine_temp": ["coolant", "coolant_temp", "engine_temp", "temp"],
                "engine_load": ["load", "engine_load"],
                "ambient_air_temp": ["ambient_air_temp", "ambient_temp", "temp"],
                "intake_temp": ["intake_temp", "intake_air_temp", "temp"],
                "odometer": ["odometer", "distance"],
                "speed": ["speed"],
                "rpm": ["rpm"],
                "battery_voltage": ["voltage", "battery_voltage", "bat"],
            }
            value = self._extract_value(payload, per_field_keys.get(field, [field]))
            self._forward_telemetry({field: value}, ts, topic)
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
                    self._forward_telemetry({matched_field: value}, ts, topic)
                else:
                    # Unknown PID — store as IoT log so data is not lost
                    self._forward_event(
                        event_type=f"obd_pid.{pid_name}",
                        level="info",
                        message=f"{at}={value}",
                        metadata=payload,
                        ts=ts,
                        topic=topic,
                    )
                return

        # --- DTC fault codes ---
        if any(at.startswith(p) for p in _DTC_TYPE_PREFIXES):
            self._handle_autopi_dtc(payload, ts, topic)
            return

        # --- GPS position ---
        if at == "track.pos" or topic == "track/pos":
            loc = payload.get("loc", {})
            self._forward_event(
                event_type="gps",
                level="info",
                message=f"lat={loc.get('lat')} lon={loc.get('lon')} sog={payload.get('sog')}",
                metadata=payload,
                ts=ts,
                topic=topic,
            )
            return

        # --- Accelerometer ---
        if at == "acc.xyz" or topic == "acc/xyz":
            self._forward_event(
                event_type="accelerometer",
                level="info",
                message=f"x={payload.get('x')} y={payload.get('y')} z={payload.get('z')}",
                metadata=payload,
                ts=ts,
                topic=topic,
            )
            return

        # --- Device events / reactor ---
        if at.startswith("event.") or topic == "reactor":
            tag = payload.get("@tag", at)
            level = "warning" if "error" in tag or "fault" in tag else "info"
            self._forward_event(
                event_type="device_event",
                level=level,
                message=tag,
                metadata=payload,
                ts=ts,
                topic=topic,
            )
            return

        # --- RPi temperature ---
        if at == "rpi.temp" or topic == "rpi/temp":
            self._forward_event(
                event_type="system",
                level="info",
                message=f"rpi_temp={payload.get('value')}",
                metadata=payload,
                ts=ts,
                topic=topic,
            )
            return

        # --- Unknown ---
        if self.verbose:
            print(f"[MQTT] Unrecognised @t={at!r} topic={topic}  payload={str(payload)[:120]}")

    def _handle_autopi_dtc(self, payload: dict, ts: str, topic: str):
        """Forward AutoPi DTC data to POST /api/v1/dtc.

        AutoPi may send a single code or a list under the 'codes' key.
        """
        codes = payload.get(_DTC_CODES_KEY)
        if isinstance(codes, list):
            for code in codes:
                dtc = {
                    "vehicle_id": self.vehicle_id,
                    "code": str(code),
                    "description": payload.get("description", ""),
                    "first_detected": ts,
                    "last_occurrence": ts,
                }
                result = self.api_client.post_dtc(dtc)
                print(f"[FORWARD] dtc OK code={code} topic={topic} status={result.get('status', 'unknown')}")
        else:
            # Single code directly in payload
            code = payload.get("code") or payload.get("@t", "unknown")
            dtc = {
                "vehicle_id": self.vehicle_id,
                "code": str(code),
                "description": payload.get("description", ""),
                "first_detected": ts,
                "last_occurrence": ts,
            }
            result = self.api_client.post_dtc(dtc)
            print(f"[FORWARD] dtc OK code={code} topic={topic} status={result.get('status', 'unknown')}")

    def _forward_telemetry(self, fields: dict, ts: str, topic: str):
        """POST a partial telemetry record (merges vehicle_id and ts)."""
        # Drop invalid values and normalize for backend schema (rpm must be int).
        data = self._normalize_telemetry_fields(fields)
        if not data:
            if self.verbose:
                print(f"[SKIP] telemetry: all fields None for topic={topic}")
            return

        body = {"vehicle_id": self.vehicle_id, "ts": ts, **data}
        result = self.api_client.post_telemetry(body)
        field_names = ", ".join(data.keys())
        print(f"[FORWARD] telemetry OK [{field_names}] topic={topic} status={result.get('status', 'unknown')}")
        
        # Display which metrics are received (green) vs missing (yellow)
        expected_metrics = ["speed", "rpm", "fuel_level", "engine_temp", "battery_voltage", "engine_load", "ambient_air_temp", "intake_temp", "odometer"]
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

    def _forward_event(self, event_type: str, level: str, message: str, metadata: dict, ts: str, topic: str):
        """POST an IoT log entry to /api/v1/dtc/iot/logs."""
        body = {
            "vehicle_id": self.vehicle_id,
            "device_id": self.autopi_device_id,
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
        "--vehicle-id", type=int, default=1,
        help="Platform vehicle_id to associate AutoPi data with (default: 1)",
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

    return parser.parse_args()


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
    print(f"[CONFIG] vehicle_id   : {args.vehicle_id}")
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
