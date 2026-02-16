from typing import Optional

from pydantic import BaseModel


class FleetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[int] = None


class FleetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None


class FleetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    manager_id: Optional[int] = None
