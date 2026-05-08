from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.maintenance import MaintenanceRecordCreate
from app.services.maintenance_service import MaintenanceService
from app.services.user_service import UserService
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])
security = HTTPBearer()


def get_current_context(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        payload = UserService.decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user_id = payload.get("user_id")
    role = (payload.get("role", "user") or "user").strip().lower()
    if role not in {"user", "admin"}:
        role = "user"

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
        )

    return {"user_id": user_id, "role": role}


def ensure_vehicle_access(db: Session, context: dict, vehicle_id: int):
    access = VehicleService.get_vehicle_by_id(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        vehicle_id=vehicle_id,
    )
    if access.get("status") != "success":
        message = access.get("message", "Acces refuse")
        code = status.HTTP_404_NOT_FOUND if "introuv" in message.lower() else status.HTTP_403_FORBIDDEN
        raise HTTPException(status_code=code, detail=message)


@router.get("/{vehicle_id}")
async def list_maintenance_records(
    vehicle_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    ensure_vehicle_access(db=db, context=context, vehicle_id=vehicle_id)
    return await MaintenanceService.list_records(vehicle_id=vehicle_id, limit=limit)


@router.post("")
async def create_maintenance_record(
    payload: MaintenanceRecordCreate,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    ensure_vehicle_access(db=db, context=context, vehicle_id=payload.vehicle_id)
    return await MaintenanceService.create_record(payload.model_dump(), user_id=context["user_id"])


@router.delete("/{record_id}")
async def delete_maintenance_record(
    record_id: str,
    context: dict = Depends(get_current_context),
):
    _ = context
    result = await MaintenanceService.delete_record(record_id)
    if result.get("status") == "error":
        if "not found" in str(result.get("message", "")).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["message"])
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result
