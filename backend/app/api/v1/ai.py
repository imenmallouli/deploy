from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.ai import (
    AIInfoResponse,
    AIInsightsResponse,
    AIPredictRequest,
    AIPredictResponse,
    AIRecommendationsResponse,
    AIRiskScoreResponse,
)
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


@router.get(
    "/info",
    response_model=AIInfoResponse,
    summary="Informations du module IA",
    description="Retourne la liste des routes IA disponibles dans le backend ainsi que leur rôle fonctionnel.",
)
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


@router.post(
    "/predict",
    response_model=AIPredictResponse,
    summary="Prédire à partir d'un payload manuel",
    description="Reçoit un snapshot télémétrique, applique le pipeline IA (nettoyage, features, inférence) puis retourne la sévérité prédite, le score de risque, les risques détectés et les suggestions de maintenance.",
)
async def predict(
    payload: AIPredictRequest,
    context: dict = Depends(get_current_context),
):
    try:
        prediction = AIInferenceService.predict_from_payload(payload.model_dump())
        return RecommendationEngine.enrich_prediction(prediction)
    except Exception as exc:
        _handle_prediction_error(exc)


@router.post(
    "/evaluate/{vehicle_id}",
    response_model=AIPredictResponse,
    summary="Évaluer le dernier état d'un véhicule",
    description="Récupère la dernière télémétrie disponible dans la base pour le véhicule demandé puis exécute le pipeline IA complet.",
)
async def evaluate_vehicle(
    vehicle_id: int,
    context: dict = Depends(get_current_context),
):
    try:
        prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
        return RecommendationEngine.enrich_prediction(prediction)
    except Exception as exc:
        _handle_prediction_error(exc)


@router.get(
    "/recommendations",
    response_model=AIRecommendationsResponse,
    summary="Obtenir les recommandations de maintenance",
    description="Retourne les recommandations dynamiques de maintenance générées à partir de la dernière prédiction IA du véhicule.",
)
async def get_recommendations(
    vehicle_id: int = Query(..., ge=1, description="Identifiant du véhicule à analyser."),
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
            "maintenance_status": enriched["maintenance_status"],
            "recommendations": enriched["maintenance_suggestions"],
        }
    except Exception as exc:
        _handle_prediction_error(exc)


@router.get(
    "/insights",
    response_model=AIInsightsResponse,
    summary="Obtenir les insights IA d'un véhicule",
    description="Retourne un résumé intelligent, les risques prédits et la priorité d'action pour le véhicule demandé.",
)
async def get_insights(
    vehicle_id: int = Query(..., ge=1, description="Identifiant du véhicule à analyser."),
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
            "maintenance_status": enriched["maintenance_status"],
            "active_dtc_events": enriched.get("active_dtc_events", []),
            "predicted_risks": enriched["predicted_risks"],
        }
    except Exception as exc:
        _handle_prediction_error(exc)


@router.get(
    "/summary",
    response_model=AIInsightsResponse,
    summary="Alias des insights IA",
    description="Alias technique de /api/v1/ai/insights pour contourner certains bloqueurs navigateur.",
)
async def get_summary(
    vehicle_id: int = Query(..., ge=1, description="Identifiant du véhicule à analyser."),
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
            "maintenance_status": enriched["maintenance_status"],
            "active_dtc_events": enriched.get("active_dtc_events", []),
            "predicted_risks": enriched["predicted_risks"],
        }
    except Exception as exc:
        _handle_prediction_error(exc)


@router.get(
    "/risk-score/{vehicle_id}",
    response_model=AIRiskScoreResponse,
    summary="Consulter le score de risque prédit",
    description="Retourne le niveau de sévérité, le score de risque entre 0 et 100 et le niveau de confiance pour le véhicule demandé.",
)
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
