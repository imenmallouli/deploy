from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator
from sqlalchemy import BigInteger, Column, DateTime, Float, Integer

from app.db.base import Base


class TelemetryData(Base):
    __tablename__ = "telemetry_data"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    vehicle_id = Column(Integer, nullable=False, index=True)
    ts = Column(DateTime(timezone=True), primary_key=True, nullable=False, default=datetime.utcnow, index=True)
    speed = Column(Float, nullable=True)
    rpm = Column(Integer, nullable=True)
    fuel_level = Column(Float, nullable=True)
    engine_temp = Column(Float, nullable=True)
    battery_voltage = Column(Float, nullable=True)
    engine_load = Column(Float, nullable=True)
    ambient_air_temp = Column(Float, nullable=True)
    intake_temp = Column(Float, nullable=True)
    odometer = Column(Float, nullable=True)


class TelemetryMongoModel(BaseModel):
    id: str | None = None
    vehicle_id: int
    device_id: str | None = None
    dongle_id: str | None = None
    autopi_device_id: str | None = None
    autopi_unit_id: str | None = None
    ts: datetime | None = None
    speed: float | None = None
    rpm: int | None = None
    fuel_level: float | None = None
    engine_temp: float | None = None
    battery_voltage: float | None = None
    battery_charge_level: float | None = None
    nominal_voltage: float | None = None
    engine_load: float | None = None
    ambient_air_temp: float | None = None
    intake_temp: float | None = None
    odometer: float | None = None
    track_altitude: float | None = None
    course_over_ground: float | None = None
    satellites_used: float | None = None
    glonass_satellites_used: float | None = None
    temp_cpu: float | None = None
    cpu: float | None = None
    gpu: float | None = None
    created_at: datetime | None = None
    created_by: int | None = None

    @model_validator(mode="after")
    def ensure_at_least_one_metric(self):
        metric_fields = [
            "speed",
            "rpm",
            "fuel_level",
            "engine_temp",
            "battery_voltage",
            "battery_charge_level",
            "nominal_voltage",
            "engine_load",
            "ambient_air_temp",
            "intake_temp",
            "odometer",
            "track_altitude",
            "course_over_ground",
            "satellites_used",
            "glonass_satellites_used",
            "temp_cpu",
            "cpu",
            "gpu",
        ]

        if not any(getattr(self, field) is not None for field in metric_fields):
            raise ValueError("Aucun champ de telemetrie valide dans le payload")

        return self

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> "TelemetryMongoModel":
        payload = dict(doc)
        mongo_id = payload.pop("_id", None)
        if mongo_id is not None:
            payload["id"] = str(mongo_id)
        return cls(**payload)

    def to_mongo(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload.pop("id", None)
        payload["ts"] = payload.get("ts") or datetime.utcnow()
        payload["created_at"] = payload.get("created_at") or datetime.utcnow()
        return payload
