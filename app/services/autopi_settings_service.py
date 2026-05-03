import os
from typing import Any

from pymongo import MongoClient

from app.db.mongodb import MONGO_DB, MONGO_HOST, MONGO_PASSWORD, MONGO_PORT, MONGO_URI, MONGO_USER, get_mongo_db

_COLLECTION = "system_settings"
_DOC_ID = "autopi_bridge"


def _sync_mongo_uri() -> str:
    if MONGO_URI:
        return MONGO_URI
    if MONGO_USER and MONGO_PASSWORD:
        return f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}"
    return f"mongodb://{MONGO_HOST}:{MONGO_PORT}"


def _default_settings() -> dict[str, Any]:
    return {
        "enabled": False,
        "email": None,
        "password": None,
        "device_id": None,
        "mqtt_host": "broker.emqx.io",
        "mqtt_port": 1883,
        "qos": 1,
        "mqtt_username": None,
        "mqtt_password": None,
        "verbose": False,
    }


def _normalize_optional(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _sanitize_for_response(settings: dict[str, Any]) -> dict[str, Any]:
    return {
        "enabled": bool(settings.get("enabled", False)),
        "email": _normalize_optional(settings.get("email")),
        "device_id": _normalize_optional(settings.get("device_id")),
        "mqtt_host": _normalize_optional(settings.get("mqtt_host")) or "broker.emqx.io",
        "mqtt_port": int(settings.get("mqtt_port") or 1883),
        "qos": int(settings.get("qos") or 1),
        "mqtt_username": _normalize_optional(settings.get("mqtt_username")),
        "verbose": bool(settings.get("verbose", False)),
        "has_password": bool(_normalize_optional(settings.get("password"))),
        "has_mqtt_password": bool(_normalize_optional(settings.get("mqtt_password"))),
    }


def _prepare_runtime_settings(raw_settings: dict[str, Any]) -> dict[str, Any]:
    settings = _default_settings()
    settings.update(raw_settings or {})
    settings["email"] = _normalize_optional(settings.get("email"))
    settings["password"] = _normalize_optional(settings.get("password"))
    settings["device_id"] = _normalize_optional(settings.get("device_id"))
    settings["mqtt_host"] = _normalize_optional(settings.get("mqtt_host")) or "broker.emqx.io"
    settings["mqtt_username"] = _normalize_optional(settings.get("mqtt_username"))
    settings["mqtt_password"] = _normalize_optional(settings.get("mqtt_password"))
    settings["mqtt_port"] = int(settings.get("mqtt_port") or 1883)
    settings["qos"] = int(settings.get("qos") or 1)
    settings["verbose"] = bool(settings.get("verbose", False))
    settings["enabled"] = bool(settings.get("enabled", False))
    return settings


def _validate_enabled_settings(settings: dict[str, Any]) -> None:
    if not settings.get("enabled"):
        return
    missing = []
    if not settings.get("email"):
        missing.append("email")
    if not settings.get("password"):
        missing.append("password")
    if not settings.get("device_id"):
        missing.append("device_id")
    if missing:
        raise ValueError(
            "Configuration AutoPi incomplete pour activation: champs manquants " + ", ".join(missing)
        )


def _sync_collection():
    client = MongoClient(_sync_mongo_uri(), serverSelectionTimeoutMS=5000)
    return client, client[MONGO_DB][_COLLECTION]


class AutoPiSettingsService:
    @staticmethod
    async def get_settings() -> dict[str, Any]:
        db = get_mongo_db()
        doc = await db[_COLLECTION].find_one({"_id": _DOC_ID}) or {}
        return {"status": "success", "settings": _sanitize_for_response(doc)}

    @staticmethod
    async def save_settings(payload: dict[str, Any]) -> dict[str, Any]:
        db = get_mongo_db()
        existing = await db[_COLLECTION].find_one({"_id": _DOC_ID}) or {}

        settings = _default_settings()
        settings.update(existing)
        settings.update(payload)

        settings["email"] = _normalize_optional(settings.get("email"))
        settings["device_id"] = _normalize_optional(settings.get("device_id"))
        settings["mqtt_host"] = _normalize_optional(settings.get("mqtt_host")) or "broker.emqx.io"
        settings["mqtt_username"] = _normalize_optional(settings.get("mqtt_username"))
        settings["mqtt_port"] = int(settings.get("mqtt_port") or 1883)
        settings["qos"] = int(settings.get("qos") or 1)
        settings["verbose"] = bool(settings.get("verbose", False))
        settings["enabled"] = bool(settings.get("enabled", False))

        incoming_password = _normalize_optional(payload.get("password"))
        incoming_mqtt_password = _normalize_optional(payload.get("mqtt_password"))
        if incoming_password is not None:
            settings["password"] = incoming_password
        else:
            settings["password"] = _normalize_optional(existing.get("password"))

        if incoming_mqtt_password is not None:
            settings["mqtt_password"] = incoming_mqtt_password
        else:
            settings["mqtt_password"] = _normalize_optional(existing.get("mqtt_password"))

        _validate_enabled_settings(settings)

        settings["_id"] = _DOC_ID
        await db[_COLLECTION].replace_one({"_id": _DOC_ID}, settings, upsert=True)
        return {"status": "success", "settings": _sanitize_for_response(settings)}

    @staticmethod
    def get_runtime_settings_sync() -> dict[str, Any]:
        env_enabled = os.getenv("ADP_AUTOPI_BRIDGE_ENABLED", "").strip().lower()
        if env_enabled in {"1", "true", "yes", "on"}:
            env_settings = _prepare_runtime_settings(
                {
                    "enabled": True,
                    "email": os.getenv("ADP_AUTOPI_EMAIL"),
                    "password": os.getenv("ADP_AUTOPI_PASSWORD"),
                    "device_id": os.getenv("ADP_AUTOPI_DEVICE_ID"),
                    "mqtt_host": os.getenv("ADP_AUTOPI_MQTT_HOST", "broker.emqx.io"),
                    "mqtt_port": os.getenv("ADP_AUTOPI_MQTT_PORT", "1883"),
                    "qos": os.getenv("ADP_AUTOPI_QOS", "1"),
                    "mqtt_username": os.getenv("ADP_AUTOPI_MQTT_USERNAME"),
                    "mqtt_password": os.getenv("ADP_AUTOPI_MQTT_PASSWORD"),
                    "verbose": os.getenv("ADP_AUTOPI_VERBOSE", "false").strip().lower() in {"1", "true", "yes", "on"},
                }
            )
            _validate_enabled_settings(env_settings)
            return env_settings

        client = None
        try:
            client, collection = _sync_collection()
            doc = collection.find_one({"_id": _DOC_ID}) or {}
            settings = _prepare_runtime_settings(doc)
            if settings.get("enabled"):
                _validate_enabled_settings(settings)
            return settings
        except Exception as exc:
            print(f"[AUTOPI] Unable to load saved settings: {exc}")
            return _default_settings()
        finally:
            if client is not None:
                client.close()