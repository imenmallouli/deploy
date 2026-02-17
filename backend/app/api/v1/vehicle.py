from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.services.user_service import UserService
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])
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


@router.post("")
def create_vehicle(
    payload: VehicleCreate,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return VehicleService.create_vehicle(
        db=db,
        role=context["role"],
        vin=payload.vin,
        license_plate=payload.license_plate,
        make=payload.make,
        model=payload.model,
        year=payload.year,
        mileage=payload.mileage,
        status=payload.status,
        fleet_id=payload.fleet_id,
        driver_id=payload.driver_id,
        dongle_id=payload.dongle_id,
        autopi_device_id=payload.autopi_device_id,
        autopi_unit_id=payload.autopi_unit_id,
    )


@router.get("")
def list_vehicles(
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return VehicleService.list_vehicles(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
    )


@router.get("/{vehicle_id}")
def get_vehicle(
    vehicle_id: int,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return VehicleService.get_vehicle_by_id(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        vehicle_id=vehicle_id,
    )


@router.get("/{vehicle_id}/status")
def get_vehicle_status(
    vehicle_id: int,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return VehicleService.get_vehicle_status(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        vehicle_id=vehicle_id,
    )


@router.put("/{vehicle_id}")
def update_vehicle(
    vehicle_id: int,
    payload: VehicleUpdate,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return VehicleService.update_vehicle(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        vehicle_id=vehicle_id,
        vin=payload.vin,
        license_plate=payload.license_plate,
        make=payload.make,
        model=payload.model,
        year=payload.year,
        mileage=payload.mileage,
        status=payload.status,
        fleet_id=payload.fleet_id,
        driver_id=payload.driver_id,
        dongle_id=payload.dongle_id,
        autopi_device_id=payload.autopi_device_id,
        autopi_unit_id=payload.autopi_unit_id,
    )


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return VehicleService.delete_vehicle(
        db=db,
        role=context["role"],
        vehicle_id=vehicle_id,
    )
