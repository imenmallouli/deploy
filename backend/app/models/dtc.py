from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DtcEventModel(BaseModel):
    id: str | None = None
    vehicle_id: int
    device_id: str | None = None
    dongle_id: str | None = None
    autopi_device_id: str | None = None
    autopi_unit_id: str | None = None
    code: str
    description: str | None = None
    category: str | None = None
    severity: str | None = None
    recommended_action: str | None = None
    first_detected: str | None = None
    last_occurrence: str | None = None
    occurrence_count: int | None = None
    mileage_at_detection: int | None = None
    resolved: bool = False
    end_date: str | None = None
    resolved_at: str | None = None
    created_at: str | None = None
    created_by: int | None = None
    cleared_at: str | None = None
    cleared_by: int | None = None

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> "DtcEventModel":
        payload = dict(doc)
        mongo_id = payload.pop("_id", None)
        if mongo_id is not None:
            payload["id"] = str(mongo_id)

        # Simulator writes can store native datetimes in Mongo while API
        # contracts expect ISO strings.
        for field in (
            "first_detected",
            "last_occurrence",
            "created_at",
            "end_date",
            "resolved_at",
            "cleared_at",
        ):
            value = payload.get(field)
            if isinstance(value, datetime):
                payload[field] = value.isoformat() + "Z"
        return cls(**payload)

    def to_mongo(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload.pop("id", None)
        if not payload.get("created_at"):
            payload["created_at"] = datetime.utcnow().isoformat() + "Z"
        return payload


class ObdRawPayloadModel(BaseModel):
    id: str | None = None
    vehicle_id: int
    dongle_id: str | None = None
    payload: dict[str, Any] | list[Any] | str | None = None
    received_at: str | None = None
    created_at: str | None = None
    created_by: int | None = None

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> "ObdRawPayloadModel":
        payload = dict(doc)
        mongo_id = payload.pop("_id", None)
        if mongo_id is not None:
            payload["id"] = str(mongo_id)
        return cls(**payload)

    def to_mongo(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload.pop("id", None)
        if not payload.get("received_at"):
            payload["received_at"] = datetime.utcnow().isoformat() + "Z"
        if not payload.get("created_at"):
            payload["created_at"] = datetime.utcnow().isoformat() + "Z"
        return payload


class IotDeviceLogModel(BaseModel):
    id: str | None = None
    vehicle_id: int | None = None
    device_id: str
    event_type: str
    level: str | None = None
    message: str | None = None
    metadata: dict[str, Any] | None = None
    event_at: str | None = None
    created_at: str | None = None
    created_by: int | None = None

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> "IotDeviceLogModel":
        payload = dict(doc)
        mongo_id = payload.pop("_id", None)
        if mongo_id is not None:
            payload["id"] = str(mongo_id)
        return cls(**payload)

    def to_mongo(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload.pop("id", None)
        if not payload.get("event_at"):
            payload["event_at"] = datetime.utcnow().isoformat() + "Z"
        if not payload.get("created_at"):
            payload["created_at"] = datetime.utcnow().isoformat() + "Z"
        return payload