from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.vehicle import Vehicle
from scripts.seed_alert_test_data import _mongo_client_with_fallback


def main():
    db = SessionLocal()
    try:
        print("Vehicles (latest 25):")
        rows = db.query(Vehicle.id, Vehicle.license_plate, Vehicle.status).order_by(Vehicle.id.desc()).limit(25).all()
        for row in rows:
            print(row)

        print("\nAlerts grouped by vehicle_id (latest 10):")
        grouped = (
            db.query(Alert.vehicle_id, Alert.status)
            .order_by(Alert.id.desc())
            .limit(500)
            .all()
        )
        counts: dict[tuple[int, str], int] = {}
        for vehicle_id, status in grouped:
            key = (vehicle_id, status or "pending")
            counts[key] = counts.get(key, 0) + 1
        for key, count in sorted(counts.items(), key=lambda item: (-item[1], item[0][0]))[:10]:
            print({"vehicle_id": key[0], "status": key[1], "count": count})

        print("\nLatest alerts (top 15):")
        latest = db.query(Alert).order_by(Alert.id.desc()).limit(15).all()
        for a in latest:
            print(
                {
                    "id": a.id,
                    "vehicle_id": a.vehicle_id,
                    "type": a.type,
                    "severity": a.severity,
                    "status": a.status,
                    "title": a.title,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
            )
    finally:
        db.close()

    client, db_name = _mongo_client_with_fallback()
    try:
        mongo_db = client[db_name]
        print("\nTelemetry grouped by vehicle_id (latest 10):")
        telemetry = list(
            mongo_db.telemetry_data.aggregate(
                [
                    {"$group": {"_id": "$vehicle_id", "c": {"$sum": 1}, "maxTs": {"$max": "$ts"}}},
                    {"$sort": {"maxTs": -1}},
                    {"$limit": 10},
                ]
            )
        )
        for item in telemetry:
            print(item)

        print("\nDTC grouped by vehicle_id (latest 10):")
        dtc = list(
            mongo_db.dtc_events.aggregate(
                [
                    {"$group": {"_id": "$vehicle_id", "c": {"$sum": 1}, "maxTs": {"$max": "$last_occurrence"}}},
                    {"$sort": {"maxTs": -1}},
                    {"$limit": 10},
                ]
            )
        )
        for item in dtc:
            print(item)
    finally:
        client.close()


if __name__ == "__main__":
    main()
