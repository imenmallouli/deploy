from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.alert import AlertAck, AlertCreate
from app.services.alert_service import AlertService
from app.services.user_service import UserService

router = APIRouter(prefix="/alerts", tags=["Alerts"])
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
    role = (payload.get("role", "user") or "user").strip().lower()
    if role not in {"user", "admin"}:
        role = "user"

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide"
        )

    return {"user_id": user_id, "role": role}


@router.get("")
def list_alerts(
    vehicle_id: int | None = Query(default=None),
    type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    return AlertService.list_alerts(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        vehicle_id=vehicle_id,
        type=type,
        severity=severity,
        alert_status=status_value,
    )


@router.get("/{vehicle_id}")
def list_alerts_by_vehicle(
    vehicle_id: int,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    return AlertService.list_alerts(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        vehicle_id=vehicle_id,
        type=None,
        severity=None,
        alert_status=None,
    )


@router.post("")
def create_alert(
    payload: AlertCreate,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    return AlertService.create_alert(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        vehicle_id=payload.vehicle_id,
        type=payload.type,
        severity=payload.severity,
        title=payload.title,
        message=payload.message,
    )


@router.post("/ack")
def ack_alert(
    payload: AlertAck,
    context: dict = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    return AlertService.ack_alert(
        db=db,
        role=context["role"],
        user_id=context["user_id"],
        alert_id=payload.alert_id,
        note=payload.note,
    )
