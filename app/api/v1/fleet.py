from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.fleet import FleetCreate, FleetUpdate, FleetVehicleAssign
from app.services.fleet_service import FleetService
from app.services.user_service import UserService

router = APIRouter(prefix="/fleets", tags=["Fleets"])
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
def create_fleet(
    payload: FleetCreate,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return FleetService.create_fleet(
        db=db,
        role=context["role"],
        name=payload.name,
        description=payload.description,
        manager_id=payload.manager_id,
    )


@router.get("")
def list_fleets(
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return FleetService.list_fleets(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
    )


@router.get("/{fleet_id}")
def get_fleet(
    fleet_id: int,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return FleetService.get_fleet_by_id(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        fleet_id=fleet_id,
    )


@router.get("/{fleet_id}/vehicles")
def list_fleet_vehicles(
    fleet_id: int,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return FleetService.list_fleet_vehicles(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        fleet_id=fleet_id,
    )


@router.post("/{fleet_id}/vehicles")
def add_vehicle_to_fleet(
    fleet_id: int,
    payload: FleetVehicleAssign,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return FleetService.add_vehicle_to_fleet(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        fleet_id=fleet_id,
        vehicle_id=payload.vehicle_id,
    )


@router.put("/{fleet_id}")
def update_fleet(
    fleet_id: int,
    payload: FleetUpdate,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return FleetService.update_fleet(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        fleet_id=fleet_id,
        name=payload.name,
        description=payload.description,
        manager_id=payload.manager_id,
    )


@router.delete("/{fleet_id}")
def delete_fleet(
    fleet_id: int,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db)
):
    return FleetService.delete_fleet(
        db=db,
        role=context["role"],
        fleet_id=fleet_id,
    )
