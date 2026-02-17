from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.fleet import Fleet
from app.models.vehicle import Vehicle


class VehicleService:
    @staticmethod
    def create_vehicle(
        db: Session,
        role: str,
        vin: str,
        license_plate: str,
        make: str,
        model: str,
        year: int,
        mileage: int = 0,
        status: str = "pending",
        fleet_id: int | None = None,
        driver_id: int | None = None,
        dongle_id: str | None = None,
        autopi_device_id: str | None = None,
        autopi_unit_id: str | None = None,
    ):
        role = (role or "driver").strip().lower()
        if role not in {"admin", "manager"}:
            return {"status": "error", "message": "Accès refusé"}

        existing_vin = db.query(Vehicle).filter(Vehicle.vin == vin).first()
        if existing_vin:
            return {"status": "error", "message": "VIN déjà existant"}

        existing_plate = db.query(Vehicle).filter(Vehicle.license_plate == license_plate).first()
        if existing_plate:
            return {"status": "error", "message": "Plaque déjà existante"}

        if dongle_id:
            existing_dongle = db.query(Vehicle).filter(Vehicle.dongle_id == dongle_id).first()
            if existing_dongle:
                return {"status": "error", "message": "Dongle déjà existant"}

        vehicle = Vehicle(
            vin=vin,
            license_plate=license_plate,
            make=make,
            model=model,
            year=year,
            mileage=mileage,
            status=status,
            fleet_id=fleet_id,
            driver_id=driver_id,
            dongle_id=dongle_id,
            autopi_device_id=autopi_device_id,
            autopi_unit_id=autopi_unit_id,
        )

        db.add(vehicle)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"status": "error", "message": "fleet_id ou driver_id invalide"}

        db.refresh(vehicle)
        return {
            "status": "success",
            "message": "Véhicule créé avec succès",
            "vehicle": VehicleService._to_dict(vehicle),
        }

    @staticmethod
    def list_vehicles(db: Session, role: str, user_id: int):
        role = (role or "driver").strip().lower()

        if role == "admin":
            vehicles = db.query(Vehicle).order_by(Vehicle.id.desc()).all()
        elif role == "manager":
            managed_fleet_ids = [
                row[0]
                for row in db.query(Fleet.id).filter(Fleet.manager_id == user_id).all()
            ]
            if not managed_fleet_ids:
                vehicles = []
            else:
                vehicles = db.query(Vehicle).filter(Vehicle.fleet_id.in_(managed_fleet_ids)).order_by(Vehicle.id.desc()).all()
        else:
            vehicles = db.query(Vehicle).filter(Vehicle.driver_id == user_id).order_by(Vehicle.id.desc()).all()

        return {
            "status": "success",
            "count": len(vehicles),
            "items": [VehicleService._to_dict(vehicle) for vehicle in vehicles],
        }

    @staticmethod
    def get_vehicle_by_id(db: Session, role: str, user_id: int, vehicle_id: int):
        role = (role or "driver").strip().lower()
        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()

        if not vehicle:
            return {"status": "error", "message": "Véhicule non trouvé"}

        if role == "manager":
            fleet = db.query(Fleet).filter(Fleet.id == vehicle.fleet_id).first()
            if not fleet or fleet.manager_id != user_id:
                return {"status": "error", "message": "Accès refusé"}

        if role == "driver" and vehicle.driver_id != user_id:
            return {"status": "error", "message": "Accès refusé"}

        return {
            "status": "success",
            "vehicle": VehicleService._to_dict(vehicle),
        }

    @staticmethod
    def get_vehicle_status(db: Session, role: str, user_id: int, vehicle_id: int):
        vehicle_result = VehicleService.get_vehicle_by_id(
            db=db,
            role=role,
            user_id=user_id,
            vehicle_id=vehicle_id,
        )

        if vehicle_result.get("status") != "success":
            return vehicle_result

        vehicle = vehicle_result["vehicle"]
        return {
            "status": "success",
            "vehicle_status": {
                "vehicle_id": vehicle["id"],
                "status": vehicle["status"],
                "last_update": vehicle["last_autopi_seen"] or vehicle["updated_at"],
                "telemetry": {
                    "mileage": vehicle["mileage"],
                },
                "autopi": {
                    "device_id": vehicle["autopi_device_id"],
                    "unit_id": vehicle["autopi_unit_id"],
                    "last_connection": vehicle["last_connection"],
                },
            },
        }

    @staticmethod
    def update_vehicle(
        db: Session,
        role: str,
        user_id: int,
        vehicle_id: int,
        vin: str | None = None,
        license_plate: str | None = None,
        make: str | None = None,
        model: str | None = None,
        year: int | None = None,
        mileage: int | None = None,
        status: str | None = None,
        fleet_id: int | None = None,
        driver_id: int | None = None,
        dongle_id: str | None = None,
        autopi_device_id: str | None = None,
        autopi_unit_id: str | None = None,
    ):
        role = (role or "driver").strip().lower()

        if role == "driver":
            return {"status": "error", "message": "Accès refusé"}

        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            return {"status": "error", "message": "Véhicule non trouvé"}

        if role == "manager":
            fleet = db.query(Fleet).filter(Fleet.id == vehicle.fleet_id).first()
            if not fleet or fleet.manager_id != user_id:
                return {"status": "error", "message": "Accès refusé"}

        if vin is not None and vin != vehicle.vin:
            existing_vin = db.query(Vehicle).filter(Vehicle.vin == vin, Vehicle.id != vehicle_id).first()
            if existing_vin:
                return {"status": "error", "message": "VIN déjà existant"}
            vehicle.vin = vin

        if license_plate is not None and license_plate != vehicle.license_plate:
            existing_plate = db.query(Vehicle).filter(Vehicle.license_plate == license_plate, Vehicle.id != vehicle_id).first()
            if existing_plate:
                return {"status": "error", "message": "Plaque déjà existante"}
            vehicle.license_plate = license_plate

        if dongle_id is not None and dongle_id != vehicle.dongle_id:
            existing_dongle = db.query(Vehicle).filter(Vehicle.dongle_id == dongle_id, Vehicle.id != vehicle_id).first()
            if existing_dongle:
                return {"status": "error", "message": "Dongle déjà existant"}
            vehicle.dongle_id = dongle_id

        if make is not None:
            vehicle.make = make
        if model is not None:
            vehicle.model = model
        if year is not None:
            vehicle.year = year
        if mileage is not None:
            vehicle.mileage = mileage
        if status is not None:
            vehicle.status = status

        if role == "admin":
            if fleet_id is not None:
                vehicle.fleet_id = fleet_id
            if driver_id is not None:
                vehicle.driver_id = driver_id

        if autopi_device_id is not None:
            vehicle.autopi_device_id = autopi_device_id
        if autopi_unit_id is not None:
            vehicle.autopi_unit_id = autopi_unit_id

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"status": "error", "message": "fleet_id ou driver_id invalide"}

        db.refresh(vehicle)
        return {
            "status": "success",
            "message": "Véhicule modifié avec succès",
            "vehicle": VehicleService._to_dict(vehicle),
        }

    @staticmethod
    def delete_vehicle(db: Session, role: str, vehicle_id: int):
        role = (role or "driver").strip().lower()
        if role != "admin":
            return {"status": "error", "message": "Accès refusé"}

        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            return {"status": "error", "message": "Véhicule non trouvé"}

        db.delete(vehicle)
        db.commit()
        return {"status": "success", "message": "Véhicule supprimé avec succès"}

    @staticmethod
    def sync_autopi_data(
        db: Session,
        role: str,
        user_id: int,
        vehicle_id: int,
        status: str | None = None,
        mileage: int | None = None,
        last_connection=None,
        last_autopi_seen=None,
        autopi_device_id: str | None = None,
        autopi_unit_id: str | None = None,
    ):
        vehicle_result = VehicleService.get_vehicle_by_id(db, role, user_id, vehicle_id)
        if vehicle_result.get("status") != "success":
            return vehicle_result

        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()

        if status is not None:
            vehicle.status = status
        if mileage is not None:
            vehicle.mileage = mileage
        if last_connection is not None:
            vehicle.last_connection = last_connection
        if last_autopi_seen is not None:
            vehicle.last_autopi_seen = last_autopi_seen
        if autopi_device_id is not None:
            vehicle.autopi_device_id = autopi_device_id
        if autopi_unit_id is not None:
            vehicle.autopi_unit_id = autopi_unit_id

        db.commit()
        db.refresh(vehicle)
        return {
            "status": "success",
            "message": "Données AutoPi synchronisées",
            "vehicle": VehicleService._to_dict(vehicle),
        }

    @staticmethod
    def _to_dict(vehicle: Vehicle):
        return {
            "id": vehicle.id,
            "vin": vehicle.vin,
            "license_plate": vehicle.license_plate,
            "make": vehicle.make,
            "model": vehicle.model,
            "year": vehicle.year,
            "mileage": vehicle.mileage,
            "status": vehicle.status,
            "fleet_id": vehicle.fleet_id,
            "driver_id": vehicle.driver_id,
            "dongle_id": vehicle.dongle_id,
            "autopi_device_id": vehicle.autopi_device_id,
            "autopi_unit_id": vehicle.autopi_unit_id,
            "last_connection": vehicle.last_connection.isoformat() if vehicle.last_connection else None,
            "last_autopi_seen": vehicle.last_autopi_seen.isoformat() if vehicle.last_autopi_seen else None,
            "created_at": vehicle.created_at.isoformat() if vehicle.created_at else None,
            "updated_at": vehicle.updated_at.isoformat() if vehicle.updated_at else None,
        }
