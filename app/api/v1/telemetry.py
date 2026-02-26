from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.telemetry import TelemetryMongoModel
from app.schemas.telemetry import TelemetryIngest
from app.services.telemetry_service import TelemetryService
from app.services.user_service import UserService

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])
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


@router.get("/ping")
async def ping_mongo_telemetry():
    try:
        return await TelemetryService.ping_mongo()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MongoDB indisponible: {str(exc)}",
        ) from exc


@router.post("")
async def create_telemetry(
    payload: TelemetryIngest,
    context: dict = Depends(get_current_context),
):
    try:
        doc = TelemetryMongoModel(**payload.model_dump())
        return await TelemetryService.create_telemetry_point(doc, user_id=context["user_id"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur insertion télémétrie MongoDB: {str(exc)}",
        ) from exc


@router.get("/{vehicle_id}")
async def get_telemetry_history(
    vehicle_id: int,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    interval: str = Query(default="1h"),
    metrics: list[str] | None = Query(default=None),
    context: dict = Depends(get_current_context),
):
    try:
        _ = context
        result = await TelemetryService.get_telemetry_history(
            vehicle_id=vehicle_id,
            start=start,
            end=end,
            interval=interval,
            metrics=metrics,
        )

        if result.get("status") == "error":
            message = result.get("message", "Erreur télémétrie")
            http_status = status.HTTP_400_BAD_REQUEST
            if "début" in message.lower() and "fin" in message.lower():
                http_status = status.HTTP_422_UNPROCESSABLE_ENTITY
            raise HTTPException(status_code=http_status, detail=message)

        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lecture télémétrie: {str(exc)}",
        ) from exc
