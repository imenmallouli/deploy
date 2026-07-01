import os
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.db.session import SessionLocal
from app.models.vehicle import Vehicle
from app.models.telemetry import TelemetryMongoModel
from app.models.dtc import DtcEventModel
from app.services.dtc_service import DtcService
from app.services.telemetry_service import TelemetryService
from typing import Annotated


router = APIRouter(prefix="/autopi-ingest", tags=["AutoPi Ingest"])

AUTOPI_AUTH_TOKEN = os.getenv("AUTOPI_AUTH_TOKEN", "")


def _check_auth(authorization: str | None):
    if not AUTOPI_AUTH_TOKEN:
        print("=" * 60)
        print("DEBUG AUTOPI AUTH")
        print("❌ AUTOPI_AUTH_TOKEN est vide !")
        print("=" * 60)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTOPI_AUTH_TOKEN non configuré sur le serveur",
        )

    expected_bearer = f"Bearer {AUTOPI_AUTH_TOKEN}"
    expected_token = f"token {AUTOPI_AUTH_TOKEN}"

    # ===== DEBUG =====
    print("=" * 60)
    print("DEBUG AUTOPI AUTH")
    print("Authorization reçu :", repr(authorization))
    print("Expected Bearer    :", repr(expected_bearer))
    print("Expected Token     :", repr(expected_token))
    print("AUTOPI_AUTH_TOKEN  :", repr(AUTOPI_AUTH_TOKEN))
    print("=" * 60)
    # =================

    if authorization not in (expected_bearer, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token AutoPi invalide",
        )


def _resolve_vehicle_id(uid: str | None) -> int | None:
    if not uid:
        return None

    db = SessionLocal()
    try:
        vehicle = (
            db.query(Vehicle)
            .filter(
                (Vehicle.autopi_unit_id == uid)
                | (Vehicle.autopi_device_id == uid)
                | (Vehicle.dongle_id == uid)
            )
            .first()
        )
        return vehicle.id if vehicle else None
    finally:
        db.close()


def _parse_ts(ts_str: str | None) -> datetime:
    if not ts_str:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


async def _handle_track_pos(item: dict, vehicle_id: int, uid: str | None):
    telemetry_payload = {
        "vehicle_id": vehicle_id,
        "autopi_unit_id": uid,
        "ts": _parse_ts(item.get("@ts")),
        "track_altitude": item.get("alt"),
        "course_over_ground": item.get("cog"),
        "satellites_used": item.get("nsat"),
    }
    doc = TelemetryMongoModel(**telemetry_payload)
    await TelemetryService.create_telemetry_point(doc, user_id=0)


async def _handle_obd_bat(item: dict, vehicle_id: int, uid: str | None):
    telemetry_payload = {
        "vehicle_id": vehicle_id,
        "autopi_unit_id": uid,
        "ts": _parse_ts(item.get("@ts")),
        "battery_voltage": item.get("voltage"),
        "battery_charge_level": item.get("level"),
    }
    doc = TelemetryMongoModel(**telemetry_payload)
    await TelemetryService.create_telemetry_point(doc, user_id=0)


async def _handle_obd_generic(item: dict, vehicle_id: int, uid: str | None, field_name: str, payload_key: str = "value"):
    telemetry_payload = {
        "vehicle_id": vehicle_id,
        "autopi_unit_id": uid,
        "ts": _parse_ts(item.get("@ts")),
        field_name: item.get(payload_key),
    }
    doc = TelemetryMongoModel(**telemetry_payload)
    await TelemetryService.create_telemetry_point(doc, user_id=0)


async def _handle_dtc(item: dict, vehicle_id: int, uid: str | None):
    code = item.get("code") or item.get("dtc") or item.get("value")
    if not code:
        return
    payload = DtcEventModel(
        vehicle_id=vehicle_id,
        autopi_unit_id=uid,
        code=str(code),
        description=item.get("description"),
        severity="warning",
        last_occurrence=_parse_ts(item.get("@ts")).isoformat(),
    )
    await DtcService.create_dtc_event(payload, user_id=0)


TYPE_HANDLERS = {
    "track.pos": _handle_track_pos,
    "obd.bat": _handle_obd_bat,
    "obd.dtc": _handle_dtc,
    "obd.rpm": lambda item, vid, uid: _handle_obd_generic(item, vid, uid, "rpm"),
    "obd.speed": lambda item, vid, uid: _handle_obd_generic(item, vid, uid, "speed"),
    "obd.coolant_temp": lambda item, vid, uid: _handle_obd_generic(item, vid, uid, "engine_temp"),
    "obd.fuel_level": lambda item, vid, uid: _handle_obd_generic(item, vid, uid, "fuel_level"),
    "obd.engine_load": lambda item, vid, uid: _handle_obd_generic(item, vid, uid, "engine_load"),
    "obd.odometer": lambda item, vid, uid: _handle_obd_generic(item, vid, uid, "odometer"),
}


@router.post("")
async def ingest_autopi_data(
    request: Request,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
):
    _check_auth(authorization)

    try:
        items = await request.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"JSON invalide: {str(exc)}",
        ) from exc

    if not isinstance(items, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le payload AutoPi doit être un tableau JSON",
        )

    processed = 0
    skipped = 0
    errors: list[str] = []

    for item in items:
        if not isinstance(item, dict):
            skipped += 1
            continue

        event_type = item.get("@t")
        uid = item.get("@uid")

        vehicle_id = _resolve_vehicle_id(uid)
        if vehicle_id is None:
            skipped += 1
            continue

        handler = TYPE_HANDLERS.get(event_type)
        if handler is None:
            skipped += 1
            continue

        try:
            await handler(item, vehicle_id, uid)
            processed += 1
        except Exception as exc:
            errors.append(f"{event_type}: {str(exc)}")
            skipped += 1

    return {
        "status": "ok",
        "processed": processed,
        "skipped": skipped,
        "errors": errors[:10],
    }