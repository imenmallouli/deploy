from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TelemetryPoint(BaseModel):
    timestamp: datetime
    value: float


class TelemetryDataResponse(BaseModel):
    speed: list[TelemetryPoint] = []
    rpm: list[TelemetryPoint] = []
    fuel_level: list[TelemetryPoint] = []
    engine_temp: list[TelemetryPoint] = []
    battery_voltage: list[TelemetryPoint] = []
    battery_charge_level: list[TelemetryPoint] = []
    nominal_voltage: list[TelemetryPoint] = []
    engine_load: list[TelemetryPoint] = []
    ambient_air_temp: list[TelemetryPoint] = []
    intake_temp: list[TelemetryPoint] = []
    odometer: list[TelemetryPoint] = []
    track_altitude: list[TelemetryPoint] = []
    course_over_ground: list[TelemetryPoint] = []
    satellites_used: list[TelemetryPoint] = []
    glonass_satellites_used: list[TelemetryPoint] = []
    temp_cpu: list[TelemetryPoint] = []
    cpu: list[TelemetryPoint] = []
    gpu: list[TelemetryPoint] = []


class TelemetryHistoryResponse(BaseModel):
    status: str
    vehicle_id: int
    start: datetime
    end: datetime
    interval: str
    data: dict


class TelemetryIngest(BaseModel):
    vehicle_id: int
    device_id: Optional[str] = None
    dongle_id: Optional[str] = None
    autopi_device_id: Optional[str] = None
    autopi_unit_id: Optional[str] = None
    ts: Optional[datetime] = None
    speed: Optional[float] = None
    rpm: Optional[int] = None
    fuel_level: Optional[float] = None
    engine_temp: Optional[float] = None
    battery_voltage: Optional[float] = None
    battery_charge_level: Optional[float] = None
    nominal_voltage: Optional[float] = None
    engine_load: Optional[float] = None
    ambient_air_temp: Optional[float] = None
    intake_temp: Optional[float] = None
    odometer: Optional[float] = None
    track_altitude: Optional[float] = None
    course_over_ground: Optional[float] = None
    satellites_used: Optional[float] = None
    glonass_satellites_used: Optional[float] = None
    temp_cpu: Optional[float] = None
    cpu: Optional[float] = None
    gpu: Optional[float] = None
