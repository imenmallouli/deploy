from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AIPredictRequest(BaseModel):
    vehicle_id: int
    plate: str | None = None
    ts: datetime | None = None
    speed: float | None = None
    rpm: float | None = None
    fuel_level: float | None = None
    engine_temp: float | None = None
    battery_voltage: float | None = None
    engine_load: float | None = None
    ambient_air_temp: float | None = None
    intake_temp: float | None = None
    odometer: float | None = None


class PredictedRiskItem(BaseModel):
    type: str
    severity: str
    message: str
    value: float | None = None


class MaintenanceSuggestion(BaseModel):
    priority: str
    title: str
    message: str


class AIInsight(BaseModel):
    summary: str
    priority: str
    next_action: str


class AIPredictResponse(BaseModel):
    vehicle_id: int
    generated_at: datetime
    source: str = "ml_model"
    model_family: str
    predicted_severity: str
    predicted_risk_score: float = Field(ge=0, le=100)
    confidence: float | None = Field(default=None, ge=0, le=100)
    telemetry_snapshot: dict
    predicted_risks: list[PredictedRiskItem] = Field(default_factory=list)
    maintenance_suggestions: list[MaintenanceSuggestion] = Field(default_factory=list)
    ai_insights: AIInsight
