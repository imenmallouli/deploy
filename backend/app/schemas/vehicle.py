from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VehicleCreate(BaseModel):
    vin: str
    license_plate: str
    make: str
    model: str
    year: int
    mileage: int = 0
    status: str = "pending"
    fleet_id: Optional[int] = None
    driver_id: Optional[int] = None
    dongle_id: Optional[str] = None
    autopi_device_id: Optional[str] = None
    autopi_unit_id: Optional[str] = None


class VehicleUpdate(BaseModel):
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    mileage: Optional[int] = None
    status: Optional[str] = None
    fleet_id: Optional[int] = None
    driver_id: Optional[int] = None
    dongle_id: Optional[str] = None
    autopi_device_id: Optional[str] = None
    autopi_unit_id: Optional[str] = None


class VehicleAutoPiSync(BaseModel):
    status: Optional[str] = None
    mileage: Optional[int] = None
    last_connection: Optional[datetime] = None
    last_autopi_seen: Optional[datetime] = None
    autopi_device_id: Optional[str] = None
    autopi_unit_id: Optional[str] = None


class VehicleResponse(BaseModel):
    id: int
    vin: str
    license_plate: str
    make: str
    model: str
    year: int
    mileage: int
    status: str
    fleet_id: Optional[int] = None
    driver_id: Optional[int] = None
    dongle_id: Optional[str] = None
    autopi_device_id: Optional[str] = None
    autopi_unit_id: Optional[str] = None
    last_connection: Optional[datetime] = None
    last_autopi_seen: Optional[datetime] = None
