from datetime import datetime

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.fleet import Fleet
from app.models.vehicle import Vehicle


class AlertService:
    @staticmethod
    def create_alert(
        db: Session,
        role: str,
        user_id: int,
        vehicle_id: int,
        type: str,
        severity: str,
        title: str,
        message: str,
    ):
        role = (role or "driver").strip().lower()

        if role not in {"admin", "manager"}:
            return {"status": "error", "message": "Accès refusé"}

        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            return {"status": "error", "message": "Véhicule non trouvé"}

        if role == "manager":
            fleet = db.query(Fleet).filter(Fleet.id == vehicle.fleet_id).first()
            if not fleet or fleet.manager_id != user_id:
                return {"status": "error", "message": "Accès refusé"}

        alert = Alert(
            vehicle_id=vehicle_id,
            type=type,
            severity=severity,
            title=title,
            message=message,
            status="pending",
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        return {
            "status": "success",
            "message": "Alerte créée avec succès",
            "alert": AlertService._to_dict(alert),
        }

    @staticmethod
    def list_alerts(
        db: Session,
        role: str,
        user_id: int,
        vehicle_id: int | None = None,
        type: str | None = None,
        severity: str | None = None,
        alert_status: str | None = None,
    ):
        role = (role or "driver").strip().lower()

        query = db.query(Alert).join(Vehicle, Vehicle.id == Alert.vehicle_id)

        if role == "manager":
            query = query.join(Fleet, Fleet.id == Vehicle.fleet_id).filter(Fleet.manager_id == user_id)
        elif role == "driver":
            query = query.filter(Vehicle.driver_id == user_id)

        if vehicle_id is not None:
            query = query.filter(Alert.vehicle_id == vehicle_id)
        if type:
            query = query.filter(Alert.type == type)
        if severity:
            query = query.filter(Alert.severity == severity)
        if alert_status:
            query = query.filter(Alert.status == alert_status)

        alerts = query.order_by(Alert.created_at.desc()).all()

        return {
            "status": "success",
            "total": len(alerts),
            "pending": len([a for a in alerts if a.status == "pending"]),
            "acknowledged": len([a for a in alerts if a.status == "acknowledged"]),
            "resolved": len([a for a in alerts if a.status == "resolved"]),
            "alerts": [AlertService._to_dict(alert) for alert in alerts],
        }

    @staticmethod
    def ack_alert(db: Session, role: str, user_id: int, alert_id: int, note: str | None = None):
        role = (role or "driver").strip().lower()

        if role == "driver":
            return {"status": "error", "message": "Accès refusé"}

        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return {"status": "error", "message": "Alerte non trouvée"}

        if role == "manager":
            vehicle = db.query(Vehicle).filter(Vehicle.id == alert.vehicle_id).first()
            if not vehicle:
                return {"status": "error", "message": "Véhicule non trouvé"}
            fleet = db.query(Fleet).filter(Fleet.id == vehicle.fleet_id).first()
            if not fleet or fleet.manager_id != user_id:
                return {"status": "error", "message": "Accès refusé"}

        alert.status = "acknowledged"
        alert.acknowledged_by = user_id
        alert.acknowledged_at = datetime.utcnow()
        alert.note = note

        db.commit()
        db.refresh(alert)

        return {
            "status": "success",
            "id": alert.id,
            "alert_id": alert.id,
            "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            "acknowledged_by": alert.acknowledged_by,
            "note": alert.note,
        }

    @staticmethod
    def _to_dict(alert: Alert):
        return {
            "id": alert.id,
            "vehicle_id": alert.vehicle_id,
            "type": alert.type,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message,
            "status": alert.status,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
            "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            "acknowledged_by": alert.acknowledged_by,
            "note": alert.note,
        }
