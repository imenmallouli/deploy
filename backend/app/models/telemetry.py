from datetime import datetime
from typing import Any

from pydantic import BaseModel
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


class TelemetryMongoModel(BaseModel):
    id: str | None = None
    vehicle_id: int
    ts: datetime | None = None
    speed: float | None = None
    rpm: int | None = None
    fuel_level: float | None = None
    engine_temp: float | None = None
    battery_voltage: float | None = None
    created_at: datetime | None = None
    created_by: int | None = None

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
