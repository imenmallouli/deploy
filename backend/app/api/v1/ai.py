from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.ai import AIPredictRequest, AIPredictResponse
from app.services.ia.inference_engine import AIInferenceService
from app.services.ia.recommendation_engine import RecommendationEngine
from app.services.user_service import UserService

router = APIRouter(prefix="/ai", tags=["AI"])
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
    role = (payload.get("role", "driver") or "driver").strip().lower()

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
        )

    return {"user_id": user_id, "role": role}


def _handle_prediction_error(exc: Exception):
    if isinstance(exc, FileNotFoundError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, LookupError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=f"AI inference error: {exc}") from exc


@router.get("/info")
def ai_info(context: dict = Depends(get_current_context)):
    return {
        "status": "success",
        "module": "ai",
        "description": "Endpoints de prédiction, recommandations et insights IA.",
        "routes": {
            "predict": "POST /api/v1/ai/predict",
            "evaluate": "POST /api/v1/ai/evaluate/{vehicle_id}",
            "recommendations": "GET /api/v1/ai/recommendations?vehicle_id=...",
            "insights": "GET /api/v1/ai/insights?vehicle_id=...",
            "risk_score": "GET /api/v1/ai/risk-score/{vehicle_id}",
        },
    }


@router.post("/predict", response_model=AIPredictResponse)
async def predict(
    payload: AIPredictRequest,
    context: dict = Depends(get_current_context),
):
    try:
        prediction = AIInferenceService.predict_from_payload(payload.model_dump())
        return RecommendationEngine.enrich_prediction(prediction)
    except Exception as exc:
        _handle_prediction_error(exc)


@router.post("/evaluate/{vehicle_id}", response_model=AIPredictResponse)
async def evaluate_vehicle(
    vehicle_id: int,
    context: dict = Depends(get_current_context),
):
    try:
        prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
        return RecommendationEngine.enrich_prediction(prediction)
    except Exception as exc:
        _handle_prediction_error(exc)


@router.get("/recommendations")
async def get_recommendations(
    vehicle_id: int = Query(..., ge=1),
    context: dict = Depends(get_current_context),
):
    try:
        prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
        enriched = RecommendationEngine.enrich_prediction(prediction)
        return {
            "status": "success",
            "vehicle_id": vehicle_id,
            "predicted_severity": enriched["predicted_severity"],
            "predicted_risk_score": enriched["predicted_risk_score"],
            "recommendations": enriched["maintenance_suggestions"],
        }
    except Exception as exc:
        _handle_prediction_error(exc)


@router.get("/insights")
async def get_insights(
    vehicle_id: int = Query(..., ge=1),
    context: dict = Depends(get_current_context),
):
    try:
        prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
        enriched = RecommendationEngine.enrich_prediction(prediction)
        return {
            "status": "success",
            "vehicle_id": vehicle_id,
            "predicted_severity": enriched["predicted_severity"],
            "predicted_risk_score": enriched["predicted_risk_score"],
            "insights": enriched["ai_insights"],
            "predicted_risks": enriched["predicted_risks"],
        }
    except Exception as exc:
        _handle_prediction_error(exc)


@router.get("/risk-score/{vehicle_id}")
async def get_risk_score(
    vehicle_id: int,
    context: dict = Depends(get_current_context),
):
    try:
        prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
        return {
            "status": "success",
            "vehicle_id": vehicle_id,
            "predicted_severity": prediction["predicted_severity"],
            "predicted_risk_score": prediction["predicted_risk_score"],
            "confidence": prediction.get("confidence"),
        }
    except Exception as exc:
        _handle_prediction_error(exc)
