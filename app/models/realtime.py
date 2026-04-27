from pydantic import BaseModel


class RealtimePredictiveSignalModel(BaseModel):
    type: str
    severity: str
    message: str
    recommendation: str


class RealtimeTelemetryMetricsModel(BaseModel):
    speed: float | None = None
    rpm: float | None = None
    fuel_level: float | None = None
    engine_temp: float | None = None
    battery_voltage: float | None = None
    engine_load: float | None = None
    ambient_air_temp: float | None = None
    intake_temp: float | None = None
    odometer: float | None = None


class RealtimeTelemetryEventModel(BaseModel):
    event: str = "telemetry_update"
    vehicle_id: int
    timestamp: str
    metrics: RealtimeTelemetryMetricsModel
    predictive_signals: list[RealtimePredictiveSignalModel] = []
