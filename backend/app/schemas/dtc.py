from typing import Optional

from pydantic import BaseModel, Field


class DtcEventCreate(BaseModel):
    vehicle_id: int
    device_id: Optional[str] = None
    dongle_id: Optional[str] = None
    autopi_device_id: Optional[str] = None
    autopi_unit_id: Optional[str] = None
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


class ObdRawPayloadCreate(BaseModel):
    vehicle_id: int
    dongle_id: Optional[str] = None
    payload: dict | list | str
    received_at: Optional[str] = None


class IotDeviceLogCreate(BaseModel):
    vehicle_id: Optional[int] = None
    device_id: str = Field(..., min_length=2, max_length=100)
    event_type: str = Field(..., min_length=2, max_length=100)
    level: Optional[str] = Field(default=None, max_length=20)
    message: Optional[str] = None
    metadata: Optional[dict] = None
    event_at: Optional[str] = None