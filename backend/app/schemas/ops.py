from pydantic import BaseModel


class GeofenceCreate(BaseModel):
    name: str
    description: str | None = None
    on_enter: str | None = None
    on_exit: str | None = None
    vehicle_count: int = 0


class GeofenceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    on_enter: str | None = None
    on_exit: str | None = None
    vehicle_count: int | None = None


class GroupCreate(BaseModel):
    name: str
    vehicle_count: int = 0


class GroupUpdate(BaseModel):
    name: str | None = None
    vehicle_count: int | None = None


class LocationCreate(BaseModel):
    name: str
    type: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class DeviceCreate(BaseModel):
    device_id: str
    vehicle_id: int | None = None
    vin: str | None = None
    status: str = "offline"


class DeviceUpdate(BaseModel):
    vehicle_id: int | None = None
    vin: str | None = None
    status: str | None = None
