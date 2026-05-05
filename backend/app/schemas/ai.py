from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AIPredictRequest(BaseModel):
    vehicle_id: int = Field(..., description="Identifiant interne du véhicule à analyser.", examples=[1])
    plate: str | None = Field(default=None, description="Plaque du véhicule pour l'affichage et la traçabilité.", examples=["TUN-001"])
    ts: datetime | None = Field(default=None, description="Date/heure de la mesure télémétrique. Si absente, l'heure courante sera utilisée.")
    speed: float | None = Field(default=None, description="Vitesse du véhicule en km/h.", examples=[72.5])
    rpm: float | None = Field(default=None, description="Régime moteur en tours par minute.", examples=[2450])
    fuel_level: float | None = Field(default=None, description="Niveau de carburant en pourcentage.", examples=[38.0])
    engine_temp: float | None = Field(default=None, description="Température moteur en degrés Celsius.", examples=[96.0])
    battery_voltage: float | None = Field(default=None, description="Tension batterie en volts.", examples=[12.4])
    engine_load: float | None = Field(default=None, description="Charge moteur en pourcentage.", examples=[54.0])
    ambient_air_temp: float | None = Field(default=None, description="Température de l'air ambiant en degrés Celsius.", examples=[28.0])
    intake_temp: float | None = Field(default=None, description="Température de l'air d'admission en degrés Celsius.", examples=[33.0])
    odometer: float | None = Field(default=None, description="Kilométrage total du véhicule.", examples=[120345.6])
    temp_cpu: float | None = Field(default=None, description="Température CPU du boîtier en degrés Celsius.", examples=[62.5])
    cpu: float | None = Field(default=None, description="Charge CPU du boîtier en pourcentage.", examples=[44.0])
    gpu: float | None = Field(default=None, description="Charge GPU du boîtier en pourcentage.", examples=[28.0])
    active_dtc_codes: list[str] = Field(
        default_factory=list,
        description="Liste des codes DTC actifs à injecter dans l'inférence IA (ex: P0300, P0171).",
        examples=[["P0300", "P0171"]],
    )


class PredictedRiskItem(BaseModel):
    type: str = Field(..., description="Type de risque détecté: battery, cooling, fuel, driving_style, etc.")
    severity: str = Field(..., description="Niveau du risque détecté: info, warning ou critical.")
    message: str = Field(..., description="Description courte du risque détecté.")
    value: float | None = Field(default=None, description="Valeur capteur associée au risque, si disponible.")


class MaintenanceSuggestion(BaseModel):
    priority: str = Field(..., description="Priorité de la maintenance: low, medium ou high.")
    title: str = Field(..., description="Titre court de la recommandation.")
    message: str = Field(..., description="Action de maintenance conseillée.")


class AIMaintenanceStatus(BaseModel):
    maintenance_required: bool = Field(..., description="Indique clairement si le vehicule doit passer en maintenance.")
    maintenance_type: str = Field(..., description="Type de maintenance conseillee: none, preventive, planned ou urgent.")
    priority: str = Field(..., description="Priorite globale de maintenance: low, medium ou high.")
    summary: str = Field(..., description="Resume clair de l'etat de maintenance du vehicule.")
    reasons: list[str] = Field(default_factory=list, description="Principales raisons qui motivent la maintenance.")


class AIInsight(BaseModel):
    summary: str = Field(..., description="Résumé global de l'état du véhicule généré à partir de la prédiction.")
    priority: str = Field(..., description="Priorité globale de l'insight: low, medium ou high.")
    next_action: str = Field(..., description="Prochaine action recommandée à l'utilisateur.")


class AIDtcEvent(BaseModel):
    code: str = Field(..., description="Code DTC actif détecté ou injecté dans l'inférence.")
    description: str | None = Field(default=None, description="Description du code défaut.")
    severity: str = Field(..., description="Sévérité du code défaut: info, warning ou critical.")
    category: str | None = Field(default=None, description="Catégorie ou origine du DTC.")
    recommended_action: str | None = Field(default=None, description="Action de maintenance recommandée pour ce code.")
    occurrence_count: int | None = Field(default=None, description="Nombre d'occurrences observées pour ce code.")
    last_occurrence: datetime | str | None = Field(default=None, description="Dernière date d'occurrence connue du code défaut.")


class AIPredictResponse(BaseModel):
    vehicle_id: int = Field(..., description="Identifiant du véhicule analysé.")
    generated_at: datetime = Field(..., description="Date/heure de génération de la prédiction.")
    source: str = Field(default="ml_model", description="Source de la décision: modèle ML ou moteur de règles.")
    model_family: str = Field(..., description="Famille de modèles utilisée pour la prédiction.")
    predicted_severity: str = Field(..., description="Classe prédite par le modèle: info, warning ou critical.")
    predicted_risk_score: float = Field(ge=0, le=100, description="Score de risque prédit entre 0 et 100.")
    confidence: float | None = Field(default=None, ge=0, le=100, description="Niveau de confiance de la classification en pourcentage.")
    telemetry_window_size: int | None = Field(default=None, description="Nombre de snapshots utilisés pour l'inférence quand une fenêtre temporelle est disponible.")
    telemetry_snapshot: dict = Field(..., description="Instantané des mesures télémétriques utilisées pour l'inférence.")
    active_dtc_events: list[AIDtcEvent] = Field(default_factory=list, description="Liste détaillée des codes défaut actifs pris en compte dans l'analyse.")
    predicted_risks: list[PredictedRiskItem] = Field(default_factory=list, description="Liste des risques identifiés à partir de la prédiction.")
    maintenance_status: AIMaintenanceStatus = Field(..., description="Statut explicite indiquant si le vehicule a besoin d'une maintenance.")
    maintenance_suggestions: list[MaintenanceSuggestion] = Field(default_factory=list, description="Liste des suggestions de maintenance générées dynamiquement.")
    ai_insights: AIInsight = Field(..., description="Résumé interprétable par l'utilisateur final.")


class AIInfoResponse(BaseModel):
    status: str
    module: str
    description: str
    routes: dict[str, str]


class AIRecommendationsResponse(BaseModel):
    status: str
    vehicle_id: int
    predicted_severity: str
    predicted_risk_score: float = Field(ge=0, le=100)
    maintenance_status: AIMaintenanceStatus
    recommendations: list[MaintenanceSuggestion] = Field(default_factory=list)


class AIInsightsResponse(BaseModel):
    status: str
    vehicle_id: int
    predicted_severity: str
    predicted_risk_score: float = Field(ge=0, le=100)
    insights: AIInsight
    maintenance_status: AIMaintenanceStatus
    active_dtc_events: list[AIDtcEvent] = Field(default_factory=list)
    predicted_risks: list[PredictedRiskItem] = Field(default_factory=list)


class AIRiskScoreResponse(BaseModel):
    status: str
    vehicle_id: int
    predicted_severity: str
    predicted_risk_score: float = Field(ge=0, le=100)
    confidence: float | None = Field(default=None, ge=0, le=100)
