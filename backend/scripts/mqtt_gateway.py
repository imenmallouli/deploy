import argparse
import importlib
import json
from datetime import datetime, timezone
from typing import Any


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


class ApiClient:
    def __init__(self, base_url: str, token: str):
        requests = _load_requests_module()
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        )

    def post_telemetry(self, payload: dict):
        response = self.session.post(f"{self.base_url}/api/v1/telemetry", json=payload, timeout=10)
        response.raise_for_status()
        return response.json()

    def post_dtc(self, payload: dict):
        response = self.session.post(f"{self.base_url}/api/v1/dtc", json=payload, timeout=10)
        response.raise_for_status()
        return response.json()

    def post_iot_log(self, payload: dict):
        response = self.session.post(f"{self.base_url}/api/v1/dtc/iot/logs", json=payload, timeout=10)
        response.raise_for_status()
        return response.json()


class MqttGateway:
    def __init__(self, api_client: ApiClient, topic_prefix: str, qos: int, verbose: bool):
        self.api_client = api_client
        self.topic_prefix = topic_prefix.rstrip("/")
        self.qos = qos
        self.verbose = verbose

    def _extract_device_id_from_topic(self, topic: str) -> str:
        prefix = f"{self.topic_prefix}/"
        if not topic.startswith(prefix):
            return "unknown-device"

        parts = topic[len(prefix):].split("/")
        if len(parts) < 2:
            return "unknown-device"

        return parts[0]

    def on_connect(self, client, userdata, flags, reason_code, properties=None):
        telemetry_topic = f"{self.topic_prefix}/+/telemetry"
        dtc_topic = f"{self.topic_prefix}/+/dtc"
        heartbeat_topic = f"{self.topic_prefix}/+/heartbeat"

        client.subscribe(telemetry_topic, qos=self.qos)
        client.subscribe(dtc_topic, qos=self.qos)
        client.subscribe(heartbeat_topic, qos=self.qos)

        print(f"[MQTT] Connected (code={reason_code})")
        print(f"[MQTT] Subscribed: {telemetry_topic}")
        print(f"[MQTT] Subscribed: {dtc_topic}")
        print(f"[MQTT] Subscribed: {heartbeat_topic}")

    def on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None):
        print(f"[MQTT] Disconnected (code={reason_code})")

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        device_id = self._extract_device_id_from_topic(topic)

        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except Exception as exc:
            print(f"[MQTT] Invalid JSON on {topic}: {exc}")
            return

        try:
            if topic.endswith("/telemetry"):
                self._handle_telemetry(payload, topic)
            elif topic.endswith("/dtc"):
                self._handle_dtc(payload, topic)
            elif topic.endswith("/heartbeat"):
                self._handle_heartbeat(payload, topic, device_id)
            else:
                if self.verbose:
                    print(f"[MQTT] Ignored topic: {topic}")
        except Exception as exc:
            print(f"[FORWARD] Error for topic={topic}: {exc}")

    def _handle_telemetry(self, payload: dict, topic: str):
        vehicle_id = payload.get("vehicle_id")
        if vehicle_id is None:
            raise RuntimeError("telemetry payload missing vehicle_id")

        if payload.get("ts") is None:
            payload["ts"] = datetime.now(timezone.utc).isoformat()

        result = self.api_client.post_telemetry(payload)
        print(f"[FORWARD] telemetry OK topic={topic} status={result.get('status', 'unknown')}")

    def _handle_dtc(self, payload: dict, topic: str):
        vehicle_id = payload.get("vehicle_id")
        if vehicle_id is None:
            raise RuntimeError("dtc payload missing vehicle_id")

        result = self.api_client.post_dtc(payload)
        print(f"[FORWARD] dtc OK topic={topic} status={result.get('status', 'unknown')}")

    def _handle_heartbeat(self, payload: dict, topic: str, device_id: str):
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
        raise RuntimeError("Login OK mais access_token introuvable")

    return token


def parse_args():
    parser = argparse.ArgumentParser(description="MQTT broker -> Auto Diagnostic Platform API gateway")

    parser.add_argument("--mqtt-host", default="127.0.0.1", help="MQTT broker host")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--mqtt-username", default=None, help="MQTT username")
    parser.add_argument("--mqtt-password", default=None, help="MQTT password")
    parser.add_argument("--mqtt-keepalive", type=int, default=60, help="MQTT keepalive")

    parser.add_argument("--topic-prefix", default="autodiag/devices", help="MQTT topic prefix")
    parser.add_argument("--qos", type=int, default=1, choices=[0, 1, 2], help="MQTT QoS")

    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend API base URL")
    parser.add_argument("--token", default=None, help="JWT token")
    parser.add_argument("--email", default=None, help="Email for API login")
    parser.add_argument("--password", default=None, help="Password for API login")

    parser.add_argument("--verbose", action="store_true", help="Verbose MQTT logs")

    return parser.parse_args()


def main():
    mqtt = _load_mqtt_module()
    args = parse_args()

    token = args.token
    if not token:
        if not args.email or not args.password:
            raise RuntimeError("Provide --token OR (--email and --password)")
        token = login_and_get_token(args.base_url, args.email, args.password)
        print("[API] Token obtained via /api/v1/auth/login")

    api_client = ApiClient(base_url=args.base_url, token=token)
    gateway = MqttGateway(
        api_client=api_client,
        topic_prefix=args.topic_prefix,
        qos=args.qos,
        verbose=args.verbose,
    )

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
