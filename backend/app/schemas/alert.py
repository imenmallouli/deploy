from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AlertAck(BaseModel):
    alert_id: int
    note: Optional[str] = None


class AlertCreate(BaseModel):
    vehicle_id: int
    type: str
    severity: str
    title: str
    message: str


class AlertResponse(BaseModel):
    id: int
    vehicle_id: int
    type: str
    severity: str
    title: str
    message: str
    status: str
    created_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[int] = None
    note: Optional[str] = None
