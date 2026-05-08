from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.fleet import Fleet
from app.models.vehicle import Vehicle


class FleetService:
    @staticmethod
    def create_fleet(db: Session, role: str, user_id: int, name: str, description: str | None = None, manager_id: int | None = None):
        role = (role or "user").strip().lower()
        if role not in {"admin", "manager", "user"}:
            return {"status": "error", "message": "Accès refusé"}

        if role in {"manager", "user"}:
            manager_id = user_id

        existing_fleet = db.query(Fleet).filter(Fleet.name == name).first()
        if existing_fleet:
            return {"status": "error", "message": "Nom de flotte déjà existant"}

        fleet = Fleet(name=name, description=description, manager_id=manager_id)
        db.add(fleet)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"status": "error", "message": "manager_id invalide"}
        db.refresh(fleet)

        return {
            "status": "success",
            "message": "Flotte créée avec succès",
            "fleet": {
                "id": fleet.id,
                "name": fleet.name,
                "description": fleet.description,
                "manager_id": fleet.manager_id,
            },
        }

    @staticmethod
    def list_fleets(db: Session, role: str, user_id: int):
        role = (role or "user").strip().lower()
        if role == "admin":
            fleets = db.query(Fleet).order_by(Fleet.id.desc()).all()
        elif role in {"manager", "user"}:
            fleets = db.query(Fleet).filter(Fleet.manager_id == user_id).order_by(Fleet.id.desc()).all()
        else:
            return {"status": "error", "message": "Accès refusé"}

        return {
            "status": "success",
            "count": len(fleets),
            "items": [
                {
                    "id": fleet.id,
                    "name": fleet.name,
                    "description": fleet.description,
                    "manager_id": fleet.manager_id,
                }
                for fleet in fleets
            ],
        }

    @staticmethod
    def get_fleet_by_id(db: Session, role: str, user_id: int, fleet_id: int):
        role = (role or "user").strip().lower()
        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        if role == "driver":
            return {"status": "error", "message": "Accès refusé"}

        if role in {"manager", "user"} and fleet.manager_id != user_id:
            return {"status": "error", "message": "Accès refusé"}

        return {
            "status": "success",
            "fleet": {
                "id": fleet.id,
                "name": fleet.name,
                "description": fleet.description,
                "manager_id": fleet.manager_id,
            },
        }

    @staticmethod
    def list_fleet_vehicles(db: Session, role: str, user_id: int, fleet_id: int):
        role = (role or "user").strip().lower()

        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        if role == "driver":
            return {"status": "error", "message": "Accès refusé"}

        if role in {"manager", "user"} and fleet.manager_id != user_id:
            return {"status": "error", "message": "Accès refusé"}

        vehicles = db.query(Vehicle).filter(Vehicle.fleet_id == fleet_id).order_by(Vehicle.id.desc()).all()
        return {
            "status": "success",
            "fleet_id": fleet_id,
            "count": len(vehicles),
            "items": [
                {
                    "id": vehicle.id,
                    "vin": vehicle.vin,
                    "license_plate": vehicle.license_plate,
                    "make": vehicle.make,
                    "model": vehicle.model,
                    "year": vehicle.year,
                    "status": vehicle.status,
                    "driver_id": vehicle.driver_id,
                }
                for vehicle in vehicles
            ],
        }

    @staticmethod
    def add_vehicle_to_fleet(db: Session, role: str, user_id: int, fleet_id: int, vehicle_id: int):
        role = (role or "user").strip().lower()

        if role == "user":
            role = "manager"

        if role not in {"admin", "manager"}:
            return {"status": "error", "message": "Accès refusé"}

        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        if role == "manager" and fleet.manager_id != user_id:
            return {"status": "error", "message": "Accès refusé"}

        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            return {"status": "error", "message": "Véhicule non trouvé"}

        if role == "manager" and vehicle.driver_id != user_id:
            return {"status": "error", "message": "Accès refusé"}

        if role == "manager" and vehicle.fleet_id is not None and vehicle.fleet_id != fleet_id:
            current_fleet = db.query(Fleet).filter(Fleet.id == vehicle.fleet_id).first()
            if not current_fleet or current_fleet.manager_id != user_id:
                return {"status": "error", "message": "Accès refusé"}

        vehicle.fleet_id = fleet_id
        db.commit()
        db.refresh(vehicle)

        return {
            "status": "success",
            "message": "Véhicule ajouté à la flotte avec succès",
            "fleet_id": fleet_id,
            "vehicle": {
                "id": vehicle.id,
                "vin": vehicle.vin,
                "license_plate": vehicle.license_plate,
                "make": vehicle.make,
                "model": vehicle.model,
                "year": vehicle.year,
                "status": vehicle.status,
                "fleet_id": vehicle.fleet_id,
            },
        }

    @staticmethod
    def update_fleet(
        db: Session,
        role: str,
        user_id: int,
        fleet_id: int,
        name: str | None = None,
        description: str | None = None,
        manager_id: int | None = None,
    ):
        role = (role or "user").strip().lower()
        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        if role == "driver":
            return {"status": "error", "message": "Accès refusé"}

        if role in {"manager", "user"} and fleet.manager_id != user_id:
            return {"status": "error", "message": "Accès refusé"}

        if name is not None and name != fleet.name:
            existing_fleet = db.query(Fleet).filter(Fleet.name == name, Fleet.id != fleet_id).first()
            if existing_fleet:
                return {"status": "error", "message": "Nom de flotte déjà existant"}
            fleet.name = name

        if description is not None:
            fleet.description = description

        if role == "admin" and manager_id is not None:
            fleet.manager_id = manager_id

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"status": "error", "message": "manager_id invalide"}
        db.refresh(fleet)

        return {
            "status": "success",
            "message": "Flotte modifiée avec succès",
            "fleet": {
                "id": fleet.id,
                "name": fleet.name,
                "description": fleet.description,
                "manager_id": fleet.manager_id,
            },
        }

    @staticmethod
    def delete_fleet(db: Session, role: str, user_id: int, fleet_id: int):
        role = (role or "user").strip().lower()

        if role not in {"admin", "manager", "user"}:
            return {"status": "error", "message": "Accès refusé"}

        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        if role in {"manager", "user"} and fleet.manager_id != user_id:
            return {"status": "error", "message": "Accès refusé"}

        # Détacher les véhicules avant de supprimer la flotte
        db.query(Vehicle).filter(Vehicle.fleet_id == fleet_id).update({"fleet_id": None})

        db.delete(fleet)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"status": "error", "message": "Impossible de supprimer: contrainte d'intégrité"}
        return {"status": "success", "message": "Flotte supprimée avec succès"}
