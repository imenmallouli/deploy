from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DtcEventModel(BaseModel):
    id: str | None = None
    vehicle_id: int
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
        return cls(**payload)

    def to_mongo(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload.pop("id", None)
        if not payload.get("created_at"):
            payload["created_at"] = datetime.utcnow().isoformat() + "Z"
        return payload