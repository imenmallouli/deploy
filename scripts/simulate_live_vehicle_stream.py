"""
simulate_live_vehicle_stream.py

Live fake-data simulator for one vehicle.

Features:
- Realtime telemetry write every 2 minutes (default)
- Full storage/diagnostic cycle every 5 minutes (default)
- DTC event insertion based on simulated conditions
- AI evaluation + SQL alert creation (visible in Alerts page)

Usage examples:
  python backend/scripts/simulate_live_vehicle_stream.py --vehicle-id 11
  python backend/scripts/simulate_live_vehicle_stream.py --plate "100TN 6000"
  python backend/scripts/simulate_live_vehicle_stream.py --vehicle-id 11 --realtime-interval-sec 120 --storage-interval-sec 300
  python backend/scripts/simulate_live_vehicle_stream.py --vehicle-id 11 --cycles 12
"""

from __future__ import annotations

import argparse
import asyncio
import math
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.vehicle import Vehicle
from app.services.alert_service import AlertService
from app.services.ia.inference_engine import AIInferenceService
from app.services.ia.recommendation_engine import RecommendationEngine
from app.services.telemetry_service import TelemetryService


@dataclass
class VehicleRef:
    vehicle_id: int
    plate: str
    dongle_id: str
    mileage: int
    make: str
    model: str


def _mongo_client_with_fallback() -> tuple[MongoClient, str]:
    env_path = BASE_DIR / ".env"
    load_dotenv(env_path)

    import os

    mongo_uri = os.getenv("MONGO_URI", "").strip()
    mongo_db = os.getenv("MONGO_DB", "mallouliauto").strip() or "mallouliauto"
    mongo_host = os.getenv("MONGO_HOST", "localhost").strip() or "localhost"
    mongo_port = os.getenv("MONGO_PORT", "27017").strip() or "27017"

    uris: list[str] = []
    if mongo_uri:
        uris.append(mongo_uri)
    uris.append(f"mongodb://{mongo_host}:{mongo_port}")
    if mongo_host in {"mongo", "adp-mongo"}:
        uris.append("mongodb://localhost:27017")

    last_error: Exception | None = None
    for uri in dict.fromkeys(uris):
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        try:
            client.admin.command("ping")
            return client, mongo_db
        except ServerSelectionTimeoutError as exc:
            last_error = exc
            client.close()

    raise RuntimeError(f"Mongo connection failed: {last_error}")


def _find_vehicle(vehicle_id: int | None, plate: str | None) -> VehicleRef:
    db = SessionLocal()
    try:
        query = db.query(Vehicle)
        row = None

        if vehicle_id is not None:
            row = query.filter(Vehicle.id == int(vehicle_id)).first()
        elif plate:
            plate_norm = plate.strip().lower()
            row = query.filter(Vehicle.license_plate.ilike(plate_norm)).first()
            if row is None:
                row = query.filter(Vehicle.license_plate.ilike(f"%{plate_norm}%")).first()

        if row is None:
            raise RuntimeError("Vehicle not found. Provide a valid --vehicle-id or --plate.")

        return VehicleRef(
            vehicle_id=int(row.id),
            plate=str(row.license_plate),
            dongle_id=str(row.dongle_id or row.autopi_device_id or row.autopi_unit_id or f"sim-dongle-{row.id}"),
            mileage=int(row.mileage or 0),
            make=str(row.make or "Unknown"),
            model=str(row.model or "Unknown"),
        )
    finally:
        db.close()


def _simulate_metrics(step: int, odometer: float, mode: str) -> dict[str, float | int]:
    phase = step / 6.0

    if mode == "normal":
        speed = 55 + 15 * math.sin(phase)
        rpm = 1800 + 350 * math.sin(phase + 0.6)
        fuel = 52 - (step * 0.04)
        temp = 88 + 3 * math.sin(phase * 0.8)
        batt = 13.7 + 0.15 * math.sin(phase)
        load = 35 + 8 * math.sin(phase * 1.1)
    elif mode == "warning":
        speed = 70 + 25 * math.sin(phase)
        rpm = 2600 + 700 * math.sin(phase + 0.5)
        fuel = 28 - (step * 0.07)
        temp = 99 + 5 * math.sin(phase * 0.9)
        batt = 12.2 + 0.25 * math.sin(phase)
        load = 68 + 15 * math.sin(phase * 1.2)
    else:  # critical
        speed = 90 + 30 * math.sin(phase)
        rpm = 3800 + 900 * math.sin(phase + 0.4)
        fuel = 8 - (step * 0.08)
        temp = 106 + 7 * math.sin(phase * 0.9)
        batt = 11.2 + 0.25 * math.sin(phase)
        load = 85 + 10 * math.sin(phase * 1.3)

    speed = max(0.0, speed + random.uniform(-4, 4))
    rpm = max(700, int(rpm + random.uniform(-180, 180)))
    fuel = max(1.0, min(100.0, fuel + random.uniform(-0.8, 0.8)))
    temp = max(70.0, min(120.0, temp + random.uniform(-1.2, 1.2)))
    batt = max(10.2, min(16.2, batt + random.uniform(-0.15, 0.15)))
    load = max(5.0, min(99.0, load + random.uniform(-3, 3)))

    ambient = max(8.0, min(45.0, 25 + 6 * math.sin(phase / 2) + random.uniform(-1.5, 1.5)))
    intake = max(12.0, min(90.0, ambient + 10 + load * 0.2 + random.uniform(-2, 2)))

    temp_cpu = max(35.0, min(95.0, 50 + load * 0.4 + random.uniform(-3, 3)))
    cpu = max(2.0, min(100.0, 20 + speed * 0.3 + random.uniform(-5, 5)))
    gpu = max(1.0, min(100.0, 15 + cpu * 0.55 + random.uniform(-8, 8)))

    return {
        "speed": round(speed, 1),
        "rpm": rpm,
        "fuel_level": round(fuel, 2),
        "engine_temp": round(temp, 1),
        "battery_voltage": round(batt, 2),
        "engine_load": round(load, 1),
        "ambient_air_temp": round(ambient, 1),
        "intake_temp": round(intake, 1),
        "odometer": round(odometer, 1),
        "temp_cpu": round(temp_cpu, 1),
        "cpu": round(cpu, 1),
        "gpu": round(gpu, 1),
        "track_altitude": round(15 + random.uniform(-2, 4), 1),
        "satellites_used": random.randint(7, 14),
        "glonass_satellites_used": random.randint(4, 10),
    }


def _infer_dtc_codes(metrics: dict[str, float | int]) -> list[str]:
    codes: list[str] = []

    if float(metrics["battery_voltage"]) < 11.5:
        codes.append("P0562")
    if float(metrics["engine_temp"]) > 106:
        codes.append("P0217")
    if float(metrics["fuel_level"]) < 10:
        codes.append("P0087")
    if int(metrics["rpm"]) > 4500:
        codes.append("P0300")
    if float(metrics["engine_load"]) > 88 and float(metrics["intake_temp"]) > 65:
        codes.append("P0171")

    seen: set[str] = set()
    unique_codes: list[str] = []
    for code in codes:
        if code not in seen:
            unique_codes.append(code)
            seen.add(code)
    return unique_codes


def _insert_dtc_events(mongo_db, vehicle: VehicleRef, dtc_codes: list[str], ts: datetime) -> int:
    if not dtc_codes:
        return 0

    severity_hint = {
        "P0562": "critical",
        "P0217": "critical",
        "P0300": "critical",
        "P0171": "warning",
        "P0087": "warning",
    }
    desc_hint = {
        "P0562": "System voltage low",
        "P0217": "Engine over-temperature condition",
        "P0300": "Random/multiple cylinder misfire detected",
        "P0171": "System too lean",
        "P0087": "Fuel rail/system pressure too low",
    }

    docs = []
    for code in dtc_codes:
        docs.append(
            {
                "vehicle_id": vehicle.vehicle_id,
                "vehicleId": vehicle.vehicle_id,
                "device_id": vehicle.dongle_id,
                "dongle_id": vehicle.dongle_id,
                "code": code,
                "dtc_code": code,
                "description": desc_hint.get(code, "Diagnostic trouble code detected"),
                "severity": severity_hint.get(code, "warning"),
                "category": "live_simulator",
                "recommended_action": f"Investigate and resolve {code}",
                "resolved": False,
                "occurrence_count": 1,
                "first_detected": ts,
                "last_occurrence": ts,
                "created_at": ts,
                "created_by": 1,
            }
        )

    mongo_db.dtc_events.insert_many(docs)
    return len(docs)


def _create_alerts_from_prediction(vehicle_id: int, enriched: dict[str, Any]) -> int:
    risks = enriched.get("predicted_risks") or []
    created = 0
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=20)

        for risk in risks:
            r_type = str(risk.get("type") or "anomaly").lower().strip()
            severity = str(risk.get("severity") or "warning").lower().strip()
            msg = str(risk.get("message") or "Anomaly detected").strip()

            if severity not in {"warning", "critical"}:
                continue

            existing = (
                db.query(Alert)
                .filter(Alert.vehicle_id == int(vehicle_id))
                .filter(Alert.type == r_type)
                .filter(Alert.severity == severity)
                .filter(Alert.status == "pending")
                .filter(Alert.created_at >= window_start)
                .first()
            )
            if existing:
                continue

            title = f"{severity.upper()} - {r_type}"
            created_alert = AlertService.create_alert_system(
                vehicle_id=int(vehicle_id),
                type=r_type,
                severity=severity,
                title=title,
                message=msg,
            )
            if created_alert:
                created += 1

        return created
    finally:
        db.close()


def _update_vehicle_mileage(vehicle_id: int, odometer: float) -> None:
    db = SessionLocal()
    try:
        row = db.query(Vehicle).filter(Vehicle.id == int(vehicle_id)).first()
        if not row:
            return
        next_mileage = int(round(float(odometer)))
        row.mileage = max(int(row.mileage or 0), next_mileage)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def run_live_simulator(
     vehicle: VehicleRef,
     mode: str,
     realtime_interval_sec: int,
     storage_interval_sec: int,
    cycles: int | None,
 ) -> None:
     mongo_client, mongo_db_name = _mongo_client_with_fallback()
     mongo_db = mongo_client[mongo_db_name]

     if realtime_interval_sec <= 0:
         raise ValueError("realtime_interval_sec must be > 0")
     if storage_interval_sec <= 0:
         raise ValueError("storage_interval_sec must be > 0")

     odometer = float(vehicle.mileage)
     step = 0
     cycles_done = 0
     next_storage_at = datetime.now(timezone.utc)

     print("\n[SIM] Starting live simulator")
     print(f"[SIM] Vehicle: id={vehicle.vehicle_id} plate={vehicle.plate} dongle={vehicle.dongle_id}")
     print(f"[SIM] Mode={mode} | realtime={realtime_interval_sec}s | storage={storage_interval_sec}s")
     print(f"[SIM] Stop with Ctrl+C")

     try:
         while True:
             now = datetime.now(timezone.utc)
             step += 1

             metrics = _simulate_metrics(step=step, odometer=odometer, mode=mode)
             speed = float(metrics["speed"])
             odometer += max(0.0, speed) * (realtime_interval_sec / 3600.0)
             metrics["odometer"] = round(odometer, 1)

             telemetry_doc = {
                 "vehicle_id": vehicle.vehicle_id,
                 "vehicleId": vehicle.vehicle_id,
                 "plate": vehicle.plate,
                 "device_id": vehicle.dongle_id,
                 "dongle_id": vehicle.dongle_id,
                 "ts": now,
                 "timestamp": now,
                 "sim_source": "live_simulator",
                 **metrics,
             }

             mongo_db.telemetry_data.insert_one(telemetry_doc)
             await TelemetryService._sync_vehicle_status_with_ai(telemetry_doc)
             _update_vehicle_mileage(vehicle.vehicle_id, float(metrics["odometer"]))

             inserted_dtc = 0
             created_alerts = 0
             if now >= next_storage_at:
                 dtc_codes = _infer_dtc_codes(metrics)
                 inserted_dtc = _insert_dtc_events(mongo_db, vehicle, dtc_codes, now)

                 prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle.vehicle_id)
                 enriched = RecommendationEngine.enrich_prediction(prediction)
                 created_alerts = _create_alerts_from_prediction(vehicle.vehicle_id, enriched)

                 report_doc = {
                     "run_at": now,
                     "source": "live_simulator",
                     "vehicle_id": vehicle.vehicle_id,
                     "plate": vehicle.plate,
                     "mode": mode,
                     "telemetry_snapshot": metrics,
                     "inserted_dtc_codes": dtc_codes,
                     "created_alerts": created_alerts,
                     "predicted_severity": enriched.get("predicted_severity"),
                     "predicted_risk_score": enriched.get("predicted_risk_score"),
                     "predicted_risks": enriched.get("predicted_risks"),
                     "maintenance_filter": enriched.get("maintenance_filter"),
                 }
                 mongo_db.diagnostic_test_reports.insert_one(report_doc)

                 next_storage_at = now + timedelta(seconds=storage_interval_sec)

             cycles_done += 1
             print(
                 f"[SIM] {now.isoformat()} | speed={metrics['speed']} km/h rpm={metrics['rpm']} "
                 f"temp={metrics['engine_temp']}C batt={metrics['battery_voltage']}V fuel={metrics['fuel_level']}% "
                 f"| dtc+={inserted_dtc} alerts+={created_alerts}"
             )

             if cycles is not None and cycles_done >= cycles:
                 print(f"[SIM] Completed {cycles_done} cycles. Stopping.")
                 break

             await asyncio.sleep(realtime_interval_sec)

     except KeyboardInterrupt:
         print("\n[SIM] Stopped by user.")
     finally:
         mongo_client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Live fake-data stream simulator for one vehicle")
    parser.add_argument("--vehicle-id", type=int, help="Target vehicle id")
    parser.add_argument("--plate", help="Target vehicle plate (exact or contains)")
    parser.add_argument("--mode", choices=["normal", "warning", "critical"], default="critical", help="Simulation mode")
    parser.add_argument("--realtime-interval-sec", type=int, default=120, help="Realtime insert interval (default: 120s = 2min)")
    parser.add_argument("--storage-interval-sec", type=int, default=300, help="Storage/diagnostic cycle interval (default: 300s = 5min)")
    parser.add_argument("--cycles", type=int, help="Optional number of realtime cycles before stop")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.vehicle_id is None and not args.plate:
        raise SystemExit("Provide --vehicle-id or --plate")

    vehicle = _find_vehicle(vehicle_id=args.vehicle_id, plate=args.plate)

    asyncio.run(
        run_live_simulator(
            vehicle=vehicle,
            mode=str(args.mode),
            realtime_interval_sec=int(args.realtime_interval_sec),
            storage_interval_sec=int(args.storage_interval_sec),
            cycles=int(args.cycles) if args.cycles is not None else None,
        )
    )


if __name__ == "__main__":
    main()
