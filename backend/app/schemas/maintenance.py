from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MaintenanceRecordCreate(BaseModel):
    vehicle_id: int = Field(..., ge=1)
    component: str = Field(..., min_length=1, max_length=100)
    serviced_at_odometer: float = Field(default=0, ge=0)
    valid_for_km: float = Field(default=0, ge=0)
    resolved_dtc_codes: list[str] = Field(default_factory=list)
    note: str | None = Field(default=None, max_length=2000)
    technicien: str | None = Field(default=None, max_length=200)
    urgency: str | None = Field(default=None, max_length=50)
    date_intervention: str | None = Field(default=None, max_length=30)


class MaintenanceRecordOut(BaseModel):
    id: str
    vehicle_id: int
    component: str
    serviced_at_odometer: float
    valid_for_km: float
    resolved_dtc_codes: list[str] = Field(default_factory=list)
    note: str = ""
    technicien: str | None = None
    urgency: str | None = None
    date_intervention: str | None = None
    created_at: datetime | None = None
    created_by: int | None = None
