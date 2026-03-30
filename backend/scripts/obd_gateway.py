import argparse
import random
import time
from datetime import datetime, timezone

import requests

try:
    import obd
except Exception:  # pragma: no cover
    obd = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ApiClient:
    def __init__(self, base_url: str, token: str):
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


def login_and_get_token(base_url: str, email: str, password: str) -> str:
    response = requests.post(
        f"{base_url.rstrip('/')}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json() or {}

    token = data.get("access_token")
    if not token:
        raise RuntimeError("Login OK mais access_token introuvable dans la réponse")
    return token


def _extract_value(response, unit_hint: str | None = None):
    if response is None or response.value is None:
        return None

    value = response.value

    try:
        if unit_hint:
            return float(value.to(unit_hint).magnitude)
        return float(value.magnitude)
    except Exception:
        try:
            return float(value)
        except Exception:
            return None


def _read_telemetry_from_obd(connection):
    rpm = _extract_value(connection.query(obd.commands.RPM))
    speed = _extract_value(connection.query(obd.commands.SPEED), "km/h")
    engine_temp = _extract_value(connection.query(obd.commands.COOLANT_TEMP), "degC")
    battery_voltage = _extract_value(connection.query(obd.commands.CONTROL_MODULE_VOLTAGE), "V")
    fuel_level = _extract_value(connection.query(obd.commands.FUEL_LEVEL), "%")

    return {
        "rpm": int(rpm) if rpm is not None else None,
        "speed": speed,
        "engine_temp": engine_temp,
        "battery_voltage": battery_voltage,
        "fuel_level": fuel_level,
    }


def _read_dtc_from_obd(connection):
    response = connection.query(obd.commands.GET_DTC)
    if response is None or response.value is None:
        return []

    dtc_items = []
    for item in response.value:
        if isinstance(item, (tuple, list)) and len(item) >= 1:
            code = str(item[0])
            description = str(item[1]) if len(item) > 1 and item[1] is not None else None
            dtc_items.append((code, description))
    return dtc_items


def _simulated_telemetry():
    return {
        "rpm": random.randint(700, 2800),
        "speed": round(random.uniform(0, 110), 2),
        "engine_temp": round(random.uniform(75, 108), 2),
        "battery_voltage": round(random.uniform(11.6, 14.4), 2),
        "fuel_level": round(random.uniform(8, 90), 2),
    }


def _simulated_dtc():
    if random.random() < 0.75:
        return []
    candidates = [
        ("P0300", "Random/Multiple Cylinder Misfire Detected"),
        ("P0420", "Catalyst System Efficiency Below Threshold"),
        ("P0171", "System Too Lean (Bank 1)"),
    ]
    return [random.choice(candidates)]


def parse_args():
    parser = argparse.ArgumentParser(description="OBD ELM327 -> Auto Diagnostic Platform API gateway")

    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend URL")
    parser.add_argument("--vehicle-id", type=int, required=True, help="Vehicle ID existant dans la base")

    parser.add_argument("--token", default=None, help="JWT access token (si absent: login via email/password)")
    parser.add_argument("--email", default=None, help="Email pour login API")
    parser.add_argument("--password", default=None, help="Mot de passe pour login API")

    parser.add_argument("--port", default=None, help="Port série ELM327 (ex: COM5)")
    parser.add_argument("--baudrate", type=int, default=None, help="Baudrate ELM327")
    parser.add_argument("--simulate", action="store_true", help="Mode simulation sans dongle")

    parser.add_argument("--telemetry-interval", type=float, default=2.0, help="Intervalle télémétrie (sec)")
    parser.add_argument("--dtc-interval", type=float, default=20.0, help="Intervalle lecture DTC (sec)")

    return parser.parse_args()


def main():
    args = parse_args()

    token = args.token
    if not token:
        if not args.email or not args.password:
            raise RuntimeError("Fournis --token OU (--email et --password)")
        token = login_and_get_token(args.base_url, args.email, args.password)
        print("[OK] Token obtenu via /auth/login")

    client = ApiClient(base_url=args.base_url, token=token)

    use_simulation = args.simulate
    connection = None

    if not use_simulation:
        if obd is None:
            raise RuntimeError("Le package python-obd n'est pas installé. Installe: pip install obd")

        print("[INFO] Connexion au dongle ELM327...")
        connection = obd.OBD(portstr=args.port, baudrate=args.baudrate, fast=False)
        if not connection.is_connected():
            raise RuntimeError("Connexion ELM327 impossible. Vérifie COM/baudrate ou utilise --simulate")
        print("[OK] Dongle connecté")

    print("[RUN] Gateway démarrée (Ctrl+C pour arrêter)")

    next_dtc_at = time.time()
    try:
        while True:
            now = time.time()

            if use_simulation:
                telemetry = _simulated_telemetry()
            else:
                telemetry = _read_telemetry_from_obd(connection)

            telemetry_payload = {
                "vehicle_id": args.vehicle_id,
                "ts": utc_now_iso(),
                "speed": telemetry.get("speed"),
                "rpm": telemetry.get("rpm"),
                "fuel_level": telemetry.get("fuel_level"),
                "engine_temp": telemetry.get("engine_temp"),
                "battery_voltage": telemetry.get("battery_voltage"),
            }

            try:
                result = client.post_telemetry(telemetry_payload)
                print(f"[TELEMETRY] OK {telemetry_payload} -> {result.get('status', 'unknown')}")
            except Exception as exc:
                print(f"[TELEMETRY] ERROR {exc}")

            if now >= next_dtc_at:
                dtc_list = _simulated_dtc() if use_simulation else _read_dtc_from_obd(connection)

                for code, description in dtc_list:
                    dtc_payload = {
                        "vehicle_id": args.vehicle_id,
                        "code": code,
                        "description": description,
                        "severity": "warning",
                        "last_occurrence": utc_now_iso(),
                    }
                    try:
                        result = client.post_dtc(dtc_payload)
                        print(f"[DTC] OK {code} -> {result.get('status', 'unknown')}")
                    except Exception as exc:
                        print(f"[DTC] ERROR {code} {exc}")

                next_dtc_at = now + args.dtc_interval

            time.sleep(args.telemetry_interval)
    except KeyboardInterrupt:
        print("\n[STOP] Gateway arrêtée")


if __name__ == "__main__":
    main()
