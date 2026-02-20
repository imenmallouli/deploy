from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.dtc import DtcEventModel
from app.schemas.dtc import DtcClearRequest, DtcEventCreate
from app.services.dtc_service import DtcService
from app.services.user_service import UserService

router = APIRouter(prefix="/dtc", tags=["DTC"])
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
async def ping_mongo():
    try:
        return await DtcService.ping_mongo()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MongoDB indisponible: {str(exc)}",
        ) from exc


@router.post("")
async def create_dtc_event(
    payload: DtcEventCreate,
    context: dict = Depends(get_current_context),
):
    try:
        event = DtcEventModel(**payload.model_dump())
        return await DtcService.create_dtc_event(event, user_id=context["user_id"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur insertion MongoDB: {str(exc)}",
        ) from exc


@router.get("")
async def list_dtc_events(
    limit: int = Query(default=50, ge=1, le=500),
    context: dict = Depends(get_current_context),
):
    try:
        _ = context
        return await DtcService.list_dtc_events(limit=limit)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lecture MongoDB: {str(exc)}",
        ) from exc


@router.get("/{vehicle_id}")
async def list_dtc_by_vehicle(
    vehicle_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    context: dict = Depends(get_current_context),
):
    try:
        _ = context
        return await DtcService.list_dtc_by_vehicle(vehicle_id=vehicle_id, limit=limit)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lecture MongoDB: {str(exc)}",
        ) from exc


@router.get("/{dtc_id}/history")
async def get_dtc_history(
    dtc_id: str,
    context: dict = Depends(get_current_context),
):
    try:
        _ = context
        result = await DtcService.get_dtc_history(dtc_id=dtc_id)
        if result.get("status") == "error":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("message", "Historique DTC introuvable"),
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lecture historique MongoDB: {str(exc)}",
        ) from exc


@router.post("/clear")
async def clear_dtc(
    payload: DtcClearRequest,
    context: dict = Depends(get_current_context),
):
    try:
        result = await DtcService.clear_dtc(
            role=context["role"],
            user_id=context["user_id"],
            vehicle_id=payload.vehicle_id,
            dtc_code=payload.dtc_code,
        )
        if result.get("status") == "error":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=result.get("message", "Accès refusé"),
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur clear MongoDB: {str(exc)}",
        ) from exc
