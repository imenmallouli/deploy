import os
import subprocess
import sys
from pathlib import Path

from app.services.autopi_settings_service import AutoPiSettingsService

_bridge_process: subprocess.Popen | None = None


def _is_enabled() -> bool:
    value = os.getenv("ADP_AUTOPI_BRIDGE_ENABLED", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _build_command(settings: dict[str, object]) -> list[str]:
    backend_root = Path(__file__).resolve().parents[2]
    script_path = backend_root / "scripts" / "mqtt_gateway.py"

    if not script_path.exists():
        raise RuntimeError(f"MQTT gateway script not found: {script_path}")

    email = str(settings.get("email") or "").strip()
    password = str(settings.get("password") or "").strip()
    autopi_device_id = str(settings.get("device_id") or "").strip()

    if not email:
        raise RuntimeError("Missing required AutoPi setting: email")
    if not password:
        raise RuntimeError("Missing required AutoPi setting: password")
    if not autopi_device_id:
        raise RuntimeError("Missing required AutoPi setting: device_id")

    cmd = [
        sys.executable,
        str(script_path),
        "--mqtt-host",
        str(settings.get("mqtt_host") or "broker.emqx.io"),
        "--mqtt-port",
        str(settings.get("mqtt_port") or "1883"),
        "--base-url",
        os.getenv("ADP_BACKEND_BASE_URL", "http://127.0.0.1:8000"),
        "--email",
        email,
        "--password",
        password,
        "--autopi-device-id",
        autopi_device_id,
        "--qos",
        str(settings.get("qos") or "1"),
    ]

    vehicle_id_fallback = os.getenv("ADP_AUTOPI_FALLBACK_VEHICLE_ID", "").strip()
    if vehicle_id_fallback:
        cmd.extend(["--vehicle-id", vehicle_id_fallback])

    topic_prefix = os.getenv("ADP_AUTOPI_TOPIC_PREFIX", "").strip()
    if topic_prefix:
        cmd.extend(["--topic-prefix", topic_prefix])

    mqtt_user = str(settings.get("mqtt_username") or "").strip()
    mqtt_pass = str(settings.get("mqtt_password") or "").strip()
    if mqtt_user:
        cmd.extend(["--mqtt-username", mqtt_user])
    if mqtt_pass:
        cmd.extend(["--mqtt-password", mqtt_pass])

    if bool(settings.get("verbose", False)):
        cmd.append("--verbose")

    return cmd


def start_autopi_bridge() -> None:
    global _bridge_process

    try:
        settings = AutoPiSettingsService.get_runtime_settings_sync()
    except Exception as exc:
        print(f"[AUTOPI] Bridge not started: {exc}")
        return

    if not bool(settings.get("enabled")):
        print("[AUTOPI] Bridge disabled")
        return

    if _bridge_process and _bridge_process.poll() is None:
        print("[AUTOPI] Bridge already running")
        return

    try:
        cmd = _build_command(settings)
    except Exception as exc:
        print(f"[AUTOPI] Bridge not started: {exc}")
        return

    try:
        _bridge_process = subprocess.Popen(cmd)
        print(f"[AUTOPI] Bridge started (pid={_bridge_process.pid})")
    except Exception as exc:
        print(f"[AUTOPI] Bridge failed to start: {exc}")


def stop_autopi_bridge() -> None:
    global _bridge_process

    if not _bridge_process:
        return

    if _bridge_process.poll() is not None:
        _bridge_process = None
        return

    try:
        _bridge_process.terminate()
        _bridge_process.wait(timeout=8)
        print("[AUTOPI] Bridge stopped")
    except Exception:
        try:
            _bridge_process.kill()
        except Exception:
            pass
    finally:
        _bridge_process = None


def restart_autopi_bridge() -> None:
    stop_autopi_bridge()
    start_autopi_bridge()
