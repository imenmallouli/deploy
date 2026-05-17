from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.db.base import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vin = Column(String(17), nullable=False, unique=True, index=True)
    license_plate = Column(String(20), nullable=False, unique=True, index=True)
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    mileage = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="pending")
    fleet_id = Column(Integer, ForeignKey("fleets.id"), nullable=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    dongle_id = Column(String(64), nullable=True, unique=True)
    autopi_device_id = Column(String(100), nullable=True, unique=True)
    autopi_unit_id = Column(String(100), nullable=True)
    last_connection = Column(DateTime, nullable=True)
    last_autopi_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
   
