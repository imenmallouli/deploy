from pydantic import BaseModel


class GeofenceCreate(BaseModel):
    name: str
    description: str | None = None
    on_enter: str | None = None
    on_exit: str | None = None
    vehicle_count: int = 0
    center_lat: float | None = None
    center_lng: float | None = None
    radius_m: float | None = None
    enabled: bool = True


class GeofenceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    on_enter: str | None = None
    on_exit: str | None = None
    vehicle_count: int | None = None
    center_lat: float | None = None
    center_lng: float | None = None
    radius_m: float | None = None
    enabled: bool | None = None


class GeofenceCheckRequest(BaseModel):
    vehicle_id: int | None = None
    latitude: float
    longitude: float


class GroupCreate(BaseModel):
    name: str
    vehicle_count: int = 0


class GroupUpdate(BaseModel):
    name: str | None = None
    vehicle_count: int | None = None


class LocationCreate(BaseModel):
    name: str
    type: str | None = None
    notes: str | None = None
    contactEmail: str | None = None
    contactPhone: str | None = None
    address: str | None = None
    onEnter: str | None = None
    onExit: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    notes: str | None = None
    contactEmail: str | None = None
    contactPhone: str | None = None
    address: str | None = None
    onEnter: str | None = None
    onExit: str | None = None
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
