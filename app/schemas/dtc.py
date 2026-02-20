from typing import Optional

from pydantic import BaseModel, Field


class DtcEventCreate(BaseModel):
    vehicle_id: int
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    recommended_action: Optional[str] = None
    first_detected: Optional[str] = None
    last_occurrence: Optional[str] = None
    occurrence_count: Optional[int] = Field(default=None, ge=1)
    mileage_at_detection: Optional[int] = Field(default=None, ge=0)
    resolved: Optional[bool] = False
    end_date: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: Optional[str] = None


class DtcClearRequest(BaseModel):
    vehicle_id: int
    dtc_code: Optional[str] = Field(default=None, min_length=2, max_length=20)