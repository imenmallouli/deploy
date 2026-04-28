from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.ops import (
    DeviceCreate,
    DeviceUpdate,
    GeofenceCheckRequest,
    GeofenceCreate,
    GeofenceExitEvent,
    GeofenceMonitoringSetup,
    GeofenceUpdate,
    GroupCreate,
    GroupUpdate,
    LocationCreate,
    LocationUpdate,
    VehiclePositionSave,
)
from app.services.ops_service import OpsService
from app.services.user_service import UserService

router = APIRouter(tags=["Ops"])
security = HTTPBearer()


def get_current_context(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = UserService.decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc)
        ) from exc

    user_id = payload.get("user_id")
    role = (payload.get("role", "driver") or "driver").strip().lower()

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide"
        )

    return {"user_id": user_id, "role": role}


@router.get("/geofences")
async def list_geofences(
    q: str | None = Query(default=None),
    context: dict = Depends(get_current_context),
):
    _ = context
    return await OpsService.list_items("geofences", q=q)


@router.post("/geofences")
async def create_geofence(payload: GeofenceCreate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.create_item("geofences", payload.model_dump())


@router.put("/geofences/{item_id}")
async def update_geofence(item_id: str, payload: GeofenceUpdate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.update_item("geofences", item_id, payload.model_dump())


@router.delete("/geofences/{item_id}")
async def delete_geofence(item_id: str, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.delete_item("geofences", item_id)


@router.post("/geofences/check")
async def check_geofences(payload: GeofenceCheckRequest, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.check_geofences(
        latitude=payload.latitude,
        longitude=payload.longitude,
        vehicle_id=payload.vehicle_id,
    )


@router.get("/geofences/vehicle-positions")
async def get_vehicle_positions(context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.get_vehicle_positions()


@router.post("/geofences/vehicle-positions")
async def save_vehicle_position(payload: VehiclePositionSave, context: dict = Depends(get_current_context)):
    _ = context
    await OpsService.save_vehicle_position(
        vehicle_id=payload.vehicle_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        speed=payload.speed,
    )
    # Trigger transition detection in backend service.
    await OpsService.check_geofences(
        latitude=payload.latitude,
        longitude=payload.longitude,
        vehicle_id=payload.vehicle_id,
    )
    return {"status": "success"}


@router.post("/geofences/monitoring/setup")
async def setup_geofence_monitoring(
    payload: GeofenceMonitoringSetup,
    context: dict = Depends(get_current_context),
):
    if context["role"] not in ("admin",):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    return await OpsService.setup_geofence_monitoring(payload)


@router.post("/geofences/exit")
async def report_geofence_exit(
    payload: GeofenceExitEvent,
    context: dict = Depends(get_current_context),
):
    if context["role"] not in ("admin",):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
    return await OpsService.handle_geofence_exit(payload)


@router.get("/groups")
async def list_groups(q: str | None = Query(default=None), context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.list_items("groups", q=q)


@router.post("/groups")
async def create_group(payload: GroupCreate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.create_item("groups", payload.model_dump())


@router.put("/groups/{item_id}")
async def update_group(item_id: str, payload: GroupUpdate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.update_item("groups", item_id, payload.model_dump())


@router.delete("/groups/{item_id}")
async def delete_group(item_id: str, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.delete_item("groups", item_id)


@router.get("/locations")
async def list_locations(q: str | None = Query(default=None), context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.list_items("locations", q=q)


@router.post("/locations")
async def create_location(payload: LocationCreate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.create_item("locations", payload.model_dump())


@router.put("/locations/{item_id}")
async def update_location(item_id: str, payload: LocationUpdate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.update_item("locations", item_id, payload.model_dump())


@router.delete("/locations/{item_id}")
async def delete_location(item_id: str, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.delete_item("locations", item_id)


@router.get("/devices")
async def list_devices(q: str | None = Query(default=None), context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.list_items("devices", q=q)


@router.get("/devices/overview")
async def devices_overview(context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.get_devices_overview()


@router.post("/devices")
async def create_device(payload: DeviceCreate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.create_item("devices", payload.model_dump())


@router.put("/devices/{item_id}")
async def update_device(item_id: str, payload: DeviceUpdate, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.update_item("devices", item_id, payload.model_dump())


@router.delete("/devices/{item_id}")
async def delete_device(item_id: str, context: dict = Depends(get_current_context)):
    _ = context
    return await OpsService.delete_item("devices", item_id)
