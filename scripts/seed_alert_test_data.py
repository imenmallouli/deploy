"""
seed_alert_test_data.py

Generates realistic fake data for end-to-end testing of the Auto Diagnostic project:
- PostgreSQL: vehicles
- MongoDB: telemetry_data, dtc_events, maintenance_records

The scenarios are aligned with backend/scripts/test_model.py thresholds so alerts can
be triggered reliably (critical/warning/info + maintenance suppression case).

Usage:
  python backend/scripts/seed_alert_test_data.py
  python backend/scripts/seed_alert_test_data.py --reset
  python backend/scripts/seed_alert_test_data.py --prefix TESTALERT --vehicles 6
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import ServerSelectionTimeoutError

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.session import SessionLocal
from app.models.fleet import Fleet  # noqa: F401 - imported for SQLAlchemy metadata registration
from app.models.user import User  # noqa: F401 - imported for SQLAlchemy metadata registration
from app.models.vehicle import Vehicle


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _mongo_client_with_fallback() -> tuple[MongoClient, str]:
    """Try app .env config first, fallback to localhost for host-side execution."""
    env_path = BASE_DIR / ".env"
    load_dotenv(env_path)

    import os

    mongo_uri = os.getenv("MONGO_URI", "").strip()
    mongo_db = os.getenv("MONGO_DB", "mallouliauto").strip() or "mallouliauto"
    mongo_host = os.getenv("MONGO_HOST", "localhost").strip() or "localhost"
    mongo_port = os.getenv("MONGO_PORT", "27017").strip() or "27017"

    candidate_uris: list[str] = []
    if mongo_uri:
        candidate_uris.append(mongo_uri)

    candidate_uris.append(f"mongodb://{mongo_host}:{mongo_port}")

    if mongo_host in {"mongo", "adp-mongo"}:
        candidate_uris.append("mongodb://localhost:27017")

    last_error: Exception | None = None
    for uri in dict.fromkeys(candidate_uris):
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        try:
            client.admin.command("ping")
            return client, mongo_db
        except ServerSelectionTimeoutError as exc:
            last_error = exc
            client.close()

    raise RuntimeError(f"Unable to connect to MongoDB. Last error: {last_error}")


def _vehicle_specs(prefix: str) -> list[dict[str, Any]]:
    return [
        {
            "slug": "critical-battery-overheat",
            "make": "Toyota",
            "model": "Corolla",
            "year": 2020,
            "status": "critical",
            "mileage": 175000,
            "base": {
                "speed": 120,
                "rpm": 4100,
                "fuel_level": 12,
                "engine_temp": 110,
                "battery_voltage": 11.1,
                "engine_load": 91,
                "ambient_air_temp": 41,
                "intake_temp": 79,
                "temp_cpu": 92,
                "cpu": 94,
                "gpu": 90,
            },
            "dtc": ["P0562", "P0217", "P0300"],
            "maintenance": [],
        },
        {
            "slug": "warning-overheat",
            "make": "Volkswagen",
            "model": "Golf",
            "year": 2019,
            "status": "warning",
            "mileage": 230000,
            "base": {
                "speed": 105,
                "rpm": 3200,
                "fuel_level": 18,
                "engine_temp": 102,
                "battery_voltage": 12.2,
                "engine_load": 79,
                "ambient_air_temp": 36,
                "intake_temp": 62,
                "temp_cpu": 84,
                "cpu": 79,
                "gpu": 64,
            },
            "dtc": ["P0171", "P0420"],
            "maintenance": [],
        },
        {
            "slug": "normal",
            "make": "Renault",
            "model": "Clio",
            "year": 2021,
            "status": "healthy",
            "mileage": 120000,
            "base": {
                "speed": 72,
                "rpm": 2200,
                "fuel_level": 56,
                "engine_temp": 90,
                "battery_voltage": 13.8,
                "engine_load": 38,
                "ambient_air_temp": 25,
                "intake_temp": 34,
                "temp_cpu": 63,
                "cpu": 42,
                "gpu": 28,
            },
            "dtc": [],
            "maintenance": [],
        },
        {
            "slug": "dtc-only",
            "make": "Peugeot",
            "model": "308",
            "year": 2018,
            "status": "warning",
            "mileage": 95000,
            "base": {
                "speed": 64,
                "rpm": 1900,
                "fuel_level": 49,
                "engine_temp": 92,
                "battery_voltage": 13.4,
                "engine_load": 33,
                "ambient_air_temp": 24,
                "intake_temp": 35,
                "temp_cpu": 60,
                "cpu": 39,
                "gpu": 22,
            },
            "dtc": ["P0300", "P0171", "P0420"],
            "maintenance": [],
        },
        {
            "slug": "critical-low-fuel-and-overvoltage",
            "make": "Ford",
            "model": "Focus",
            "year": 2017,
            "status": "critical",
            "mileage": 210000,
            "base": {
                "speed": 96,
                "rpm": 4600,
                "fuel_level": 3,
                "engine_temp": 104,
                "battery_voltage": 16.1,
                "engine_load": 89,
                "ambient_air_temp": 34,
                "intake_temp": 68,
                "temp_cpu": 90,
                "cpu": 92,
                "gpu": 87,
            },
            "dtc": ["P0605", "P0217"],
            "maintenance": [],
        },
        {
            "slug": "suppressed-by-maintenance",
            "make": "Hyundai",
            "model": "i30",
            "year": 2022,
            "status": "healthy",
            "mileage": 150000,
            "base": {
                "speed": 81,
                "rpm": 2400,
                "fuel_level": 44,
                "engine_temp": 101,
                "battery_voltage": 11.9,
                "engine_load": 56,
                "ambient_air_temp": 28,
                "intake_temp": 40,
                "temp_cpu": 70,
                "cpu": 48,
                "gpu": 29,
            },
            "dtc": ["P0562", "P0171", "P0420"],
            "maintenance": [
                {
                    "component": "battery_system",
                    "valid_for_km": 5000,
                    "offset_km": 800,
                    "resolved_dtc_codes": ["P0562"],
                    "note": "Battery and alternator checked",
                },
                {
                    "component": "dtc",
                    "valid_for_km": 4000,
                    "offset_km": 600,
                    "resolved_dtc_codes": ["P0171", "P0420"],
                    "note": "DTC root causes fixed",
                },
                {
                    "component": "cooling_system",
                    "valid_for_km": 5000,
                    "offset_km": 1000,
                    "resolved_dtc_codes": [],
                    "note": "Cooling service done",
                },
            ],
        },
    ]


def _make_identity(prefix: str, idx: int) -> tuple[str, str, str]:
    """Returns vin, plate, dongle_id."""
    vin = f"{prefix[:6].upper():<6}".replace(" ", "X") + f"{idx:011d}"
    vin = vin[:17]
    plate = f"{prefix.upper()}-{idx:03d}"
    dongle_id = f"{prefix.lower()}-dongle-{idx:03d}"
    return vin, plate, dongle_id


def _upsert_vehicles(prefix: str, max_vehicles: int) -> list[dict[str, Any]]:
    specs = _vehicle_specs(prefix)[:max_vehicles]

    db = SessionLocal()
    created: list[dict[str, Any]] = []
    try:
        for idx, spec in enumerate(specs, start=1):
            vin, plate, dongle_id = _make_identity(prefix, idx)

            existing = db.query(Vehicle).filter(Vehicle.license_plate == plate).first()
            if existing is None:
                existing = Vehicle(
                    vin=vin,
                    license_plate=plate,
                    make=spec["make"],
                    model=spec["model"],
                    year=int(spec["year"]),
                    mileage=int(spec["mileage"]),
                    status=str(spec["status"]),
                    dongle_id=dongle_id,
                    autopi_device_id=dongle_id,
                    autopi_unit_id=f"unit-{idx:03d}",
                    last_connection=datetime.utcnow(),
                    last_autopi_seen=datetime.utcnow(),
                )
                db.add(existing)
                db.flush()
            else:
                existing.make = spec["make"]
                existing.model = spec["model"]
                existing.year = int(spec["year"])
                existing.mileage = int(spec["mileage"])
                existing.status = str(spec["status"])
                existing.dongle_id = existing.dongle_id or dongle_id
                existing.autopi_device_id = existing.autopi_device_id or dongle_id
                existing.last_autopi_seen = datetime.utcnow()

            created.append(
                {
                    "vehicle_id": int(existing.id),
                    "vin": existing.vin,
                    "plate": existing.license_plate,
                    "dongle_id": existing.dongle_id,
                    "mileage": int(existing.mileage),
                    "spec": spec,
                }
            )

        db.commit()
        return created
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _build_telemetry_series(vehicle: dict[str, Any], points: int = 180) -> list[dict[str, Any]]:
    spec = vehicle["spec"]
    base = dict(spec["base"])

    now = datetime.now(timezone.utc)
    rows: list[dict[str, Any]] = []

    for i in range(points):
        ts = now - timedelta(minutes=(points - i) * 5)

        speed = max(0.0, float(base["speed"]) + random.uniform(-10, 10))
        rpm = max(650.0, float(base["rpm"]) + random.uniform(-450, 450))
        fuel = max(0.5, min(99.0, float(base["fuel_level"]) + random.uniform(-4, 3)))
        engine_temp = max(65.0, min(120.0, float(base["engine_temp"]) + random.uniform(-3, 3)))
        battery = max(10.0, min(16.5, float(base["battery_voltage"]) + random.uniform(-0.35, 0.35)))
        load = max(5.0, min(99.0, float(base["engine_load"]) + random.uniform(-7, 7)))
        ambient = max(5.0, min(50.0, float(base["ambient_air_temp"]) + random.uniform(-2, 2)))
        intake = max(10.0, min(90.0, float(base["intake_temp"]) + random.uniform(-3, 3)))
        temp_cpu = max(35.0, min(98.0, float(base["temp_cpu"]) + random.uniform(-3, 3)))
        cpu = max(1.0, min(100.0, float(base["cpu"]) + random.uniform(-8, 8)))
        gpu = max(1.0, min(100.0, float(base["gpu"]) + random.uniform(-8, 8)))

        odometer = float(vehicle["mileage"]) + (i * max(speed, 5.0) / 60.0)

        row = {
            "vehicle_id": vehicle["vehicle_id"],
            "vehicleId": vehicle["vehicle_id"],
            "plate": vehicle["plate"],
            "dongle_id": vehicle["dongle_id"],
            "device_id": vehicle["dongle_id"],
            "timestamp": ts,
            "ts": ts,
            "speed": round(speed, 1),
            "rpm": int(rpm),
            "fuel_level": round(fuel, 2),
            "engine_temp": round(engine_temp, 1),
            "battery_voltage": round(battery, 2),
            "engine_load": round(load, 1),
            "ambient_air_temp": round(ambient, 1),
            "intake_temp": round(intake, 1),
            "odometer": round(odometer, 1),
            "temp_cpu": round(temp_cpu, 1),
            "cpu": round(cpu, 1),
            "gpu": round(gpu, 1),
            "track_altitude": round(20 + random.uniform(-4, 6), 1),
            "satellites_used": random.randint(7, 14),
        }
        rows.append(row)

    # Force a severe latest point for non-normal scenarios.
    if spec["slug"] != "normal":
        last = rows[-1]
        for key in (
            "speed",
            "rpm",
            "fuel_level",
            "engine_temp",
            "battery_voltage",
            "engine_load",
            "ambient_air_temp",
            "intake_temp",
            "temp_cpu",
            "cpu",
            "gpu",
        ):
            if key in base:
                last[key] = base[key]

    return rows


def _build_dtc_events(vehicle: dict[str, Any]) -> list[dict[str, Any]]:
    spec = vehicle["spec"]
    events: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    severity_hint = {
        "P0562": "critical",
        "P0217": "critical",
        "P0605": "critical",
        "P0300": "critical",
        "P0171": "warning",
        "P0420": "warning",
    }
    desc_hint = {
        "P0562": "System voltage low",
        "P0217": "Engine over-temperature condition",
        "P0605": "Internal control module ROM error",
        "P0300": "Random/multiple cylinder misfire detected",
        "P0171": "System too lean",
        "P0420": "Catalyst system efficiency below threshold",
    }

    for i, code in enumerate(spec["dtc"], start=1):
        first_detected = now - timedelta(hours=12 + i)
        last_occurrence = now - timedelta(minutes=10 + i)
        sev = severity_hint.get(code, "warning")
        events.append(
            {
                "vehicle_id": vehicle["vehicle_id"],
                "vehicleId": vehicle["vehicle_id"],
                "device_id": vehicle["dongle_id"],
                "dongle_id": vehicle["dongle_id"],
                "code": code,
                "dtc_code": code,
                "description": desc_hint.get(code, "Diagnostic trouble code detected"),
                "severity": sev,
                "category": "seed_test",
                "recommended_action": f"Investigate and resolve {code}",
                "resolved": False,
                "occurrence_count": random.randint(1, 4),
                "first_detected": first_detected,
                "last_occurrence": last_occurrence,
                "created_at": first_detected,
                "updated_at": last_occurrence,
            }
        )

    return events


def _build_maintenance_records(vehicle: dict[str, Any]) -> list[dict[str, Any]]:
    spec = vehicle["spec"]
    records: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for item in spec.get("maintenance", []):
        serviced_at = float(vehicle["mileage"]) - float(item.get("offset_km", 0))
        records.append(
            {
                "vehicle_id": vehicle["vehicle_id"],
                "component": str(item.get("component") or "general_service").lower(),
                "serviced_at_odometer": max(0.0, serviced_at),
                "valid_for_km": float(item.get("valid_for_km") or 3000),
                "resolved_dtc_codes": [str(c).upper() for c in (item.get("resolved_dtc_codes") or [])],
                "note": str(item.get("note") or "Seeded maintenance"),
                "technicien": "seed-bot",
                "urgency": "routine",
                "date_intervention": now.date().isoformat(),
                "created_at": now,
                "created_by": 1,
            }
        )

    return records


def _delete_existing_seed_data(prefix: str, mongo_db) -> None:
    plates = [f"{prefix.upper()}-{i:03d}" for i in range(1, 200)]
    plate_regex = {"$regex": f"^{prefix.upper()}-"}

    # Delete from Mongo collections first.
    mongo_db.telemetry_data.delete_many({"$or": [{"plate": plate_regex}, {"license_plate": plate_regex}]})
    mongo_db.dtc_events.delete_many({"$or": [{"plate": plate_regex}, {"license_plate": plate_regex}]})
    mongo_db.maintenance_records.delete_many({"vehicle_id": {"$in": []}})

    # Get matching vehicles from Postgres to clean relational + linked Mongo docs.
    db = SessionLocal()
    try:
        vehicles = db.query(Vehicle).filter(Vehicle.license_plate.in_(plates)).all()
        vehicle_ids = [int(v.id) for v in vehicles]
        if vehicle_ids:
            mongo_db.telemetry_data.delete_many({"$or": [{"vehicle_id": {"$in": vehicle_ids}}, {"vehicleId": {"$in": vehicle_ids}}]})
            mongo_db.dtc_events.delete_many({"$or": [{"vehicle_id": {"$in": vehicle_ids}}, {"vehicleId": {"$in": vehicle_ids}}]})
            mongo_db.maintenance_records.delete_many({"vehicle_id": {"$in": vehicle_ids}})

        for v in vehicles:
            db.delete(v)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _insert_many_if_any(collection: Collection, docs: list[dict[str, Any]]) -> int:
    if not docs:
        return 0
    return len(collection.insert_many(docs).inserted_ids)


def seed(prefix: str, max_vehicles: int, reset: bool) -> None:
    random.seed(42)

    mongo_client, mongo_db_name = _mongo_client_with_fallback()
    mongo_db = mongo_client[mongo_db_name]

    if reset:
        _delete_existing_seed_data(prefix=prefix, mongo_db=mongo_db)

    vehicles = _upsert_vehicles(prefix=prefix, max_vehicles=max_vehicles)

    telemetry_docs: list[dict[str, Any]] = []
    dtc_docs: list[dict[str, Any]] = []
    maintenance_docs: list[dict[str, Any]] = []

    for v in vehicles:
        telemetry_docs.extend(_build_telemetry_series(v))
        dtc_docs.extend(_build_dtc_events(v))
        maintenance_docs.extend(_build_maintenance_records(v))

    inserted_telemetry = _insert_many_if_any(mongo_db.telemetry_data, telemetry_docs)
    inserted_dtc = _insert_many_if_any(mongo_db.dtc_events, dtc_docs)
    inserted_maintenance = _insert_many_if_any(mongo_db.maintenance_records, maintenance_docs)

    print("\nSeed completed successfully")
    print(f"- Vehicles (Postgres): {len(vehicles)}")
    print(f"- telemetry_data (Mongo): {inserted_telemetry}")
    print(f"- dtc_events (Mongo): {inserted_dtc}")
    print(f"- maintenance_records (Mongo): {inserted_maintenance}")
    print("\nVehicles created/updated:")
    for v in vehicles:
        print(f"  id={v['vehicle_id']:>3} | plate={v['plate']} | dongle={v['dongle_id']} | scenario={v['spec']['slug']}")

    print("\nQuick checks:")
    print(f"  python backend/scripts/test_model.py")
    print(f"  Mongo filter example: {{ vehicleId: {vehicles[0]['vehicle_id']} }}")
    print(f"  Timestamp (UTC): {_iso_now()}")

    mongo_client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed fake vehicles + telemetry + dtc + maintenance for alert testing")
    parser.add_argument("--prefix", default="TESTALERT", help="Prefix used for generated license plates")
    parser.add_argument("--vehicles", type=int, default=6, help="How many scenarios to seed (max: 6)")
    parser.add_argument("--reset", action="store_true", help="Delete previous seeded data with same prefix before seeding")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    vehicles = max(1, min(6, int(args.vehicles)))
    seed(prefix=str(args.prefix).strip() or "TESTALERT", max_vehicles=vehicles, reset=bool(args.reset))


if __name__ == "__main__":
    main()
