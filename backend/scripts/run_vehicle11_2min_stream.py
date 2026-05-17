"""
Launcher dedicated to vehicle_id=11.

Behavior:
- Inject telemetry every 120 seconds
- Run DTC + AI diagnostic cycle every 120 seconds
- Run a full pipeline test (Telemetry + DTC + Alerts + IA)

Usage:
  python scripts/run_vehicle11_2min_stream.py
  python scripts/run_vehicle11_2min_stream.py --cycles 3
  python scripts/run_vehicle11_2min_stream.py --continuous
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.session import SessionLocal
from app.models.alert import Alert
from scripts.simulate_live_vehicle_stream import (
    _find_vehicle,
    _mongo_client_with_fallback,
    run_live_simulator,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full 2-min pipeline test for vehicle 11")
    parser.add_argument(
        "--cycles",
        type=int,
        default=3,
        help="Number of 2-min cycles (default: 3). Ignored with --continuous.",
    )
    parser.add_argument(
        "--continuous",
        action="store_true",
        help="Run forever until Ctrl+C",
    )
    return parser.parse_args()


def _print_summary(vehicle_id: int, started_at: datetime) -> None:
    mongo_client, mongo_db_name = _mongo_client_with_fallback()
    mongo_db = mongo_client[mongo_db_name]

    window_start_utc = started_at.astimezone(timezone.utc)
    sql_window_start = window_start_utc.replace(tzinfo=None)

    telemetry_count = mongo_db.telemetry_data.count_documents(
        {"vehicle_id": vehicle_id, "ts": {"$gte": window_start_utc}}
    )
    dtc_count = mongo_db.dtc_events.count_documents(
        {"vehicle_id": vehicle_id, "created_at": {"$gte": window_start_utc}}
    )

    sql_db = SessionLocal()
    try:
        alerts_count = (
            sql_db.query(Alert)
            .filter(Alert.vehicle_id == vehicle_id)
            .filter(Alert.created_at >= sql_window_start)
            .count()
        )
    finally:
        sql_db.close()
        mongo_client.close()

    print("\n[TEST] Pipeline summary")
    print(f"[TEST] vehicle_id={vehicle_id}")
    print(f"[TEST] telemetry_inserted={telemetry_count}")
    print(f"[TEST] dtc_inserted={dtc_count}")
    print(f"[TEST] alerts_created={alerts_count}")

    if telemetry_count > 0 and dtc_count > 0 and alerts_count > 0:
        print("[TEST] RESULT=PASS (Telemetry + DTC + Alerts)")
    else:
        print("[TEST] RESULT=PARTIAL (check counters above)")


def _check_prerequisites() -> None:
    try:
        import openpyxl  # noqa: F401
    except Exception as exc:
        raise SystemExit(
            "openpyxl manquant. Installez-le d'abord: pip install openpyxl\n"
            f"Détail: {exc}"
        ) from exc


async def _main() -> None:
    args = _parse_args()
    _check_prerequisites()
    started_at = datetime.now(timezone.utc)

    try:
        vehicle = _find_vehicle(vehicle_id=11, plate=None)
    except RuntimeError as exc:
        raise SystemExit(
            "vehicle_id=11 introuvable dans la base active du backend. "
            "Vérifiez que vous exécutez ce script dans le même environnement que votre API/UI. "
            f"Détail: {exc}"
        ) from exc

    run_cycles = None if args.continuous else max(1, int(args.cycles))

    await run_live_simulator(
        vehicle=vehicle,
        mode="critical",
        realtime_interval_sec=120,
        storage_interval_sec=120,
        cycles=run_cycles,
    )

    if run_cycles is not None:
        _print_summary(vehicle.vehicle_id, started_at)


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
