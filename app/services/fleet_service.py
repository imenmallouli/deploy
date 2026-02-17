from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.fleet import Fleet


class FleetService:
    @staticmethod
    def create_fleet(db: Session, role: str, name: str, description: str | None = None, manager_id: int | None = None):
        role = (role or "driver").strip().lower()
        if role != "admin":
            return {"status": "error", "message": "Accès refusé"}

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
        role = (role or "driver").strip().lower()
        if role == "admin":
            fleets = db.query(Fleet).order_by(Fleet.id.desc()).all()
        elif role == "manager":
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
        role = (role or "driver").strip().lower()
        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        if role == "driver":
            return {"status": "error", "message": "Accès refusé"}

        if role == "manager" and fleet.manager_id != user_id:
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
    def update_fleet(
        db: Session,
        role: str,
        user_id: int,
        fleet_id: int,
        name: str | None = None,
        description: str | None = None,
        manager_id: int | None = None,
    ):
        role = (role or "driver").strip().lower()
        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        if role == "driver":
            return {"status": "error", "message": "Accès refusé"}

        if role == "manager" and fleet.manager_id != user_id:
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
    def delete_fleet(db: Session, role: str, fleet_id: int):
        role = (role or "driver").strip().lower()
        if role != "admin":
            return {"status": "error", "message": "Accès refusé"}

        fleet = db.query(Fleet).filter(Fleet.id == fleet_id).first()
        if not fleet:
            return {"status": "error", "message": "Flotte non trouvée"}

        db.delete(fleet)
        db.commit()
        return {"status": "success", "message": "Flotte supprimée avec succès"}
