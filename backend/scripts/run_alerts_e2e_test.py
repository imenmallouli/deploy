"""
run_alerts_e2e_test.py

Automated end-to-end alert test for simulated vehicles.

What it does:
1) Optionally seeds fake vehicles + telemetry + DTC + maintenance.
2) Runs AI evaluation on each seeded vehicle.
3) Verifies expected alert behavior (thresholds, DTC, maintenance suppression).
4) Saves a diagnostic report in MongoDB for audit/history.

Usage:
  python backend/scripts/run_alerts_e2e_test.py --seed-first --reset-seed
  python backend/scripts/run_alerts_e2e_test.py --prefix TESTALERT
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.session import SessionLocal
from app.models.fleet import Fleet  # noqa: F401 - metadata registration
from app.models.user import User  # noqa: F401 - metadata registration
from app.models.vehicle import Vehicle
from app.services.ia.inference_engine import AIInferenceService
from app.services.ia.recommendation_engine import RecommendationEngine
from scripts.seed_alert_test_data import seed as seed_alert_data


SCENARIO_SLUG_BY_INDEX = {
    1: "critical-battery-overheat",
    2: "warning-overheat",
    3: "normal",
    4: "dtc-only",
    5: "critical-low-fuel-and-overvoltage",
    6: "suppressed-by-maintenance",
}


@dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _mongo_client_with_fallback() -> tuple[MongoClient, str]:
    env_path = BASE_DIR / ".env"
    load_dotenv(env_path)

    mongo_uri = os.getenv("MONGO_URI", "").strip()
    mongo_db = os.getenv("MONGO_DB", "mallouliauto").strip() or "mallouliauto"
    mongo_host = os.getenv("MONGO_HOST", "localhost").strip() or "localhost"
    mongo_port = os.getenv("MONGO_PORT", "27017").strip() or "27017"

    candidates: list[str] = []
    if mongo_uri:
        candidates.append(mongo_uri)
    candidates.append(f"mongodb://{mongo_host}:{mongo_port}")
    if mongo_host in {"mongo", "adp-mongo"}:
        candidates.append("mongodb://localhost:27017")

    last_error: Exception | None = None
    for uri in dict.fromkeys(candidates):
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        try:
            client.admin.command("ping")
            return client, mongo_db
        except ServerSelectionTimeoutError as exc:
            last_error = exc
            client.close()

    raise RuntimeError(f"Unable to connect to MongoDB. Last error: {last_error}")


def _get_seed_vehicles(prefix: str) -> list[Vehicle]:
    db = SessionLocal()
    try:
        rows = (
            db.query(Vehicle)
            .filter(Vehicle.license_plate.like(f"{prefix.upper()}-%"))
            .order_by(Vehicle.license_plate.asc())
            .all()
        )
        return rows
    finally:
        db.close()


def _scenario_slug_from_plate(plate: str) -> str:
    try:
        idx = int(plate.split("-")[-1])
    except (TypeError, ValueError):
        return "unknown"
    return SCENARIO_SLUG_BY_INDEX.get(idx, "unknown")


def _base_checks(enriched: dict[str, Any]) -> list[CheckResult]:
    checks: list[CheckResult] = []
    severity = str(enriched.get("predicted_severity") or "").lower()
    score = float(enriched.get("predicted_risk_score") or 0.0)
    risks = enriched.get("predicted_risks") or []
    dtc_events = enriched.get("active_dtc_events") or []

    checks.append(CheckResult("severity_valid", severity in {"info", "warning", "critical"}, f"severity={severity}"))
    checks.append(CheckResult("score_range", 0.0 <= score <= 100.0, f"score={score}"))
    checks.append(CheckResult("risks_list_exists", isinstance(risks, list), f"risks_count={len(risks)}"))
    checks.append(CheckResult("dtc_list_exists", isinstance(dtc_events, list), f"dtc_count={len(dtc_events)}"))
    return checks


def _scenario_checks(slug: str, enriched: dict[str, Any]) -> list[CheckResult]:
    checks: list[CheckResult] = []
    severity = str(enriched.get("predicted_severity") or "").lower()
    score = float(enriched.get("predicted_risk_score") or 0.0)
    risks = enriched.get("predicted_risks") or []
    dtc_events = enriched.get("active_dtc_events") or []
    maintenance_filter = enriched.get("maintenance_filter") or {}

    risk_types = {str(item.get("type") or "") for item in risks if isinstance(item, dict)}
    has_dtc_alert = "dtc" in risk_types

    if slug == "critical-battery-overheat":
        checks.append(CheckResult("critical_expected", severity == "critical", f"severity={severity}"))
        checks.append(CheckResult("battery_or_cooling_risk", bool({"battery", "cooling"} & risk_types), f"risk_types={sorted(risk_types)}"))
        checks.append(CheckResult("dtc_detected", len(dtc_events) >= 1, f"dtc_count={len(dtc_events)}"))

    elif slug == "warning-overheat":
        checks.append(CheckResult("warning_or_critical_expected", severity in {"warning", "critical"}, f"severity={severity}"))
        checks.append(CheckResult("thermal_risk_detected", bool({"cooling", "intake", "thermal_delta"} & risk_types), f"risk_types={sorted(risk_types)}"))

    elif slug == "normal":
        severe_risks = [r for r in risks if str(r.get("severity") or "") in {"warning", "critical"}]
        checks.append(CheckResult("normal_expected", severity == "info", f"severity={severity}"))
        checks.append(CheckResult("no_warning_or_critical_risks", len(severe_risks) == 0, f"severe_risks={len(severe_risks)}"))

    elif slug == "dtc-only":
        checks.append(CheckResult("dtc_events_present", len(dtc_events) >= 1, f"dtc_count={len(dtc_events)}"))
        checks.append(CheckResult("dtc_alert_generated", has_dtc_alert, f"risk_types={sorted(risk_types)}"))

    elif slug == "critical-low-fuel-and-overvoltage":
        checks.append(CheckResult("critical_expected", severity == "critical" or score >= 70.0, f"severity={severity},score={score}"))
        checks.append(CheckResult("fuel_or_battery_risk", bool({"fuel", "battery"} & risk_types), f"risk_types={sorted(risk_types)}"))

    elif slug == "suppressed-by-maintenance":
        suppressed = maintenance_filter.get("suppressed_alerts") or []
        checks.append(CheckResult("maintenance_filter_applied", bool(maintenance_filter.get("applied")), f"filter={maintenance_filter.get('applied')}"))
        checks.append(CheckResult("suppressed_alerts_present", len(suppressed) >= 1, f"suppressed_count={len(suppressed)}"))
        checks.append(CheckResult("severity_downgraded_to_info", severity == "info", f"severity={severity}"))

    else:
        checks.append(CheckResult("known_scenario", False, f"unknown slug={slug}"))

    return checks


async def _evaluate_vehicle(vehicle: Vehicle) -> dict[str, Any]:
    slug = _scenario_slug_from_plate(vehicle.license_plate)
    raw = await AIInferenceService.predict_latest_for_vehicle(int(vehicle.id))
    enriched = RecommendationEngine.enrich_prediction(raw)

    checks = _base_checks(enriched) + _scenario_checks(slug, enriched)
    passed = all(item.passed for item in checks)

    return {
        "vehicle_id": int(vehicle.id),
        "plate": vehicle.license_plate,
        "scenario": slug,
        "passed": passed,
        "predicted_severity": enriched.get("predicted_severity"),
        "predicted_risk_score": enriched.get("predicted_risk_score"),
        "predicted_risks_count": len(enriched.get("predicted_risks") or []),
        "active_dtc_count": len(enriched.get("active_dtc_events") or []),
        "maintenance_filter": enriched.get("maintenance_filter") or {},
        "checks": [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in checks],
        "diagnostic_payload": {
            "ai_insights": enriched.get("ai_insights"),
            "maintenance_status": enriched.get("maintenance_status"),
            "predicted_risks": enriched.get("predicted_risks"),
            "active_dtc_events": enriched.get("active_dtc_events"),
        },
    }


async def run(prefix: str, seed_first: bool, reset_seed: bool, vehicles_count: int) -> dict[str, Any]:
    if seed_first:
        seed_alert_data(prefix=prefix, max_vehicles=vehicles_count, reset=reset_seed)

    rows = _get_seed_vehicles(prefix=prefix)
    if not rows:
        raise RuntimeError(f"No vehicles found for prefix '{prefix}'. Run with --seed-first.")

    results: list[dict[str, Any]] = []
    for row in rows:
        results.append(await _evaluate_vehicle(row))

    total = len(results)
    passed = sum(1 for item in results if item["passed"])
    failed = total - passed

    report = {
        "run_at": _utc_now_iso(),
        "prefix": prefix.upper(),
        "status": "success" if failed == 0 else "failed",
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
        },
        "results": results,
    }

    mongo_client, mongo_db_name = _mongo_client_with_fallback()
    try:
        db = mongo_client[mongo_db_name]
        db.diagnostic_test_reports.insert_one(report)
    finally:
        mongo_client.close()

    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run automated E2E alert tests on simulated vehicles")
    parser.add_argument("--prefix", default="TESTALERT", help="License plate prefix for simulated vehicles")
    parser.add_argument("--seed-first", action="store_true", help="Generate fake data before running tests")
    parser.add_argument("--reset-seed", action="store_true", help="Reset previous data for this prefix when used with --seed-first")
    parser.add_argument("--vehicles", type=int, default=6, help="Number of vehicles/scenarios to seed")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = asyncio.run(
        run(
            prefix=str(args.prefix).strip() or "TESTALERT",
            seed_first=bool(args.seed_first),
            reset_seed=bool(args.reset_seed),
            vehicles_count=max(1, min(6, int(args.vehicles))),
        )
    )
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if report["summary"]["failed"] > 0:
        print("\nFailed scenarios:")
        for item in report["results"]:
            if item["passed"]:
                continue
            failed_checks = [c for c in item["checks"] if not c["passed"]]
            print(f"- {item['plate']} ({item['scenario']})")
            for chk in failed_checks:
                print(f"    * {chk['name']}: {chk['detail']}")


if __name__ == "__main__":
    main()
