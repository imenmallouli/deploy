"""
test_maintenance_suppression_scenarios.py — Comprehensive testing of maintenance-based alert suppression.

Tests various scenarios to ensure database-driven maintenance records correctly suppress alerts:
1. Scenario A: Recently serviced battery system — P0562 should be suppressed
2. Scenario B: Expired maintenance validity window — alerts should NOT be suppressed  
3. Scenario C: Mixed situation — some components recently serviced, others not
4. Scenario D: DTC resolved but component not serviced — should still suppress if in resolved_dtc_codes

Usage:
    python backend/scripts/test_maintenance_suppression_scenarios.py
"""
from __future__ import annotations
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.mongodb import get_mongo_db
from app.services.ia.inference_engine import AIInferenceService
from app.services.ia.recommendation_engine import RecommendationEngine


async def cleanup_vehicle_data(vehicle_id: int):
    """Clean up all data for a vehicle."""
    db = get_mongo_db()
    await db.maintenance_records.delete_many({"vehicle_id": vehicle_id})
    await db.telemetry_data.delete_many({"vehicle_id": vehicle_id})
    await db.dtc_events.delete_many({"vehicle_id": vehicle_id})


async def insert_telemetry(
    vehicle_id: int,
    odometer: float = 150000,
    battery_voltage: float = 12.6,
    engine_temp: float = 90.0,
    intake_temp: float = 30.0,
):
    """Insert telemetry for testing."""
    db = get_mongo_db()
    
    await db.telemetry_data.insert_one({
        "vehicle_id": vehicle_id,
        "plate": f"TEST-{vehicle_id:03d}",
        "ts": datetime.now(timezone.utc),
        "speed": 80.0,
        "rpm": 2400.0,
        "fuel_level": 45.0,
        "engine_temp": engine_temp,
        "battery_voltage": battery_voltage,
        "engine_load": 55.0,
        "ambient_air_temp": 28.0,
        "intake_temp": intake_temp,
        "odometer": odometer,
        "temp_cpu": 70.0,
        "cpu": 40.0,
        "gpu": 20.0,
    })


async def insert_dtc_events(vehicle_id: int, dtcs: list[dict]):
    """Insert active (unresolved) DTC events for a vehicle."""
    db = get_mongo_db()
    now = datetime.now(timezone.utc)
    docs = []
    for dtc in dtcs:
        docs.append(
            {
                "vehicle_id": vehicle_id,
                "code": str(dtc.get("code") or "DTC_UNKNOWN").strip().upper(),
                "description": str(dtc.get("description") or "Code defaut detecte"),
                "severity": str(dtc.get("severity") or "warning").lower(),
                "category": "test_dtc",
                "recommended_action": dtc.get("recommended_action"),
                "occurrence_count": int(dtc.get("occurrence_count") or 1),
                "last_occurrence": now,
                "resolved": False,
                "created_at": now,
            }
        )

    if docs:
        await db.dtc_events.insert_many(docs)


async def scenario_a():
    """Scenario A: Recently serviced battery system — P0562 should be suppressed."""
    print("\n" + "="*70)
    print("  SCENARIO A: Recently serviced battery — P0562 should be suppressed")
    print("="*70)
    
    vehicle_id = 101
    await cleanup_vehicle_data(vehicle_id)
    
    # Insert maintenance record: battery recently serviced
    db = get_mongo_db()
    await db.maintenance_records.insert_one({
        "vehicle_id": vehicle_id,
        "component": "battery_system",
        "serviced_at_odometer": 149200.0,
        "valid_for_km": 5000.0,
        "resolved_dtc_codes": ["P0562"],
        "note": "Battery replaced",
    })
    
    # Current odometer: 150000 km (within valid window: 149200 + 5000)
    # Keep telemetry nominal to isolate DTC/battery suppression behavior.
    await insert_telemetry(vehicle_id, odometer=150000, battery_voltage=11.2, engine_temp=90.0, intake_temp=30.0)
    await insert_dtc_events(
        vehicle_id,
        [
            {
                "code": "P0562",
                "description": "Tension systeme faible",
                "severity": "critical",
            }
        ],
    )

    prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
    
    enriched = RecommendationEngine.enrich_prediction(prediction)
    
    print(f"\n  Input:")
    print(f"    - Current odometer: 150000 km")
    print(f"    - Last battery service: 149200 km (800 km ago)")
    print(f"    - Valid for: 5000 km (expires at 154200 km)")
    print(f"    - Active DTC: P0562 (Tension system faible)")
    print(f"    - Resolved at service: P0562")
    
    print(f"\n  Result:")
    print(f"    - Maintenance Required: {enriched['maintenance_status']['maintenance_required']}")
    print(f"    - Predicted Risks: {len(enriched.get('predicted_risks', []))}")

    risks = enriched.get("predicted_risks", [])
    has_battery_risk = any(r.get("type") == "battery" for r in risks)
    has_p0562_dtc_risk = any(r.get("type") == "dtc" and "P0562" in str(r.get("message")) for r in risks)

    # Verify targeted suppression: battery + dtc(P0562) must be removed.
    if not has_battery_risk and not has_p0562_dtc_risk:
        print(f"\n  ✓ PASS: P0562/battery alerts were suppressed (battery recently serviced)")
        return True
    else:
        print(f"\n  ✗ FAIL: P0562/battery alert was NOT suppressed")
        for risk in enriched.get('predicted_risks', []):
            print(f"    - {risk['type']}: {risk['message']}")
        return False


async def scenario_b():
    """Scenario B: Expired maintenance validity window — alerts should NOT be suppressed."""
    print("\n" + "="*70)
    print("  SCENARIO B: Expired maintenance window — P0562 should NOT be suppressed")
    print("="*70)
    
    vehicle_id = 102
    await cleanup_vehicle_data(vehicle_id)
    
    # Insert maintenance record: battery service is EXPIRED
    db = get_mongo_db()
    await db.maintenance_records.insert_one({
        "vehicle_id": vehicle_id,
        "component": "battery_system",
        "serviced_at_odometer": 145000.0,  # Old service
        "valid_for_km": 3000.0,  # Expires at 148000
        "resolved_dtc_codes": ["P0562"],
        "note": "Old battery service",
    })
    
    # Current odometer: 150000 km (OUTSIDE valid window)
    await insert_telemetry(vehicle_id, odometer=150000, battery_voltage=11.2, engine_temp=90.0, intake_temp=30.0)
    await insert_dtc_events(
        vehicle_id,
        [
            {
                "code": "P0562",
                "description": "Tension systeme faible",
                "severity": "critical",
            }
        ],
    )

    prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
    
    enriched = RecommendationEngine.enrich_prediction(prediction)
    
    print(f"\n  Input:")
    print(f"    - Current odometer: 150000 km")
    print(f"    - Last battery service: 145000 km (5000 km ago)")
    print(f"    - Valid for: 3000 km (EXPIRED at 148000 km)")
    print(f"    - Active DTC: P0562")
    print(f"    - Resolved at service: P0562")
    
    print(f"\n  Result:")
    print(f"    - Maintenance Required: {enriched['maintenance_status']['maintenance_required']}")
    print(f"    - Predicted Risks: {len(enriched.get('predicted_risks', []))}")
    
    # Verify NO suppression (window is expired): battery and/or DTC should still appear.
    risks = enriched.get("predicted_risks", [])
    has_battery_risk = any(r.get("type") == "battery" for r in risks)
    has_p0562_dtc_risk = any(r.get("type") == "dtc" and "P0562" in str(r.get("message")) for r in risks)
    if has_battery_risk or has_p0562_dtc_risk:
        print(f"\n  ✓ PASS: P0562 alert was NOT suppressed (maintenance window expired)")
        return True
    else:
        print(f"\n  ✗ FAIL: P0562 alert WAS suppressed (should not have been)")
        return False


async def scenario_c():
    """Scenario C: Mixed situation — some components serviced, others not."""
    print("\n" + "="*70)
    print("  SCENARIO C: Mixed — battery serviced but cooling system not")
    print("="*70)
    
    vehicle_id = 103
    await cleanup_vehicle_data(vehicle_id)
    
    # Insert multiple maintenance records
    db = get_mongo_db()
    await db.maintenance_records.insert_many([
        {
            "vehicle_id": vehicle_id,
            "component": "battery_system",
            "serviced_at_odometer": 149200.0,
            "valid_for_km": 5000.0,
            "resolved_dtc_codes": ["P0562"],
        },
        # Note: NO cooling_system service record
    ])
    
    # Current odometer: 150000 km
    await insert_telemetry(vehicle_id, odometer=150000, battery_voltage=11.2, engine_temp=101.0, intake_temp=39.0)
    await insert_dtc_events(
        vehicle_id,
        [
            {
                "code": "P0562",
                "description": "Tension systeme faible",
                "severity": "critical",
            },
            {
                "code": "P0217",
                "description": "Temperature moteur trop elevee",
                "severity": "critical",
            },
        ],
    )

    prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
    
    enriched = RecommendationEngine.enrich_prediction(prediction)
    
    print(f"\n  Input:")
    print(f"    - Active DTCs: P0562 (battery), P0217 (cooling)")
    print(f"    - Battery service: 149200 km (within 5000 km validity)")
    print(f"    - Cooling service: NONE")
    
    print(f"\n  Result:")
    print(f"    - Predicted Risks: {len(enriched.get('predicted_risks', []))}")
    
    if len(enriched.get('predicted_risks', [])) > 0:
        print(f"    - Risks found:")
        for risk in enriched.get('predicted_risks', []):
            print(f"      * {risk['type']}: {risk['message']}")

        risk_messages = " ".join(str(r.get("message")) for r in enriched.get("predicted_risks", []))
        has_p0562 = "P0562" in risk_messages
        has_p0217 = "P0217" in risk_messages
        has_cooling = any(r.get("type") in {"cooling", "thermal_delta"} for r in enriched.get("predicted_risks", []))

        # P0562 should be suppressed (battery recently serviced), P0217/cooling should remain.
        if (not has_p0562) and (has_p0217 or has_cooling):
            print(f"\n  ✓ PASS: P0562 suppressed (battery serviced), P0217 not suppressed (cooling not serviced)")
            return True
        else:
            print(f"\n  ✗ FAIL: Mixed suppression pattern incorrect")
            return False
    else:
        print(f"\n  ✗ FAIL: All alerts suppressed (P0217 should not be)")
        return False


async def scenario_d():
    """Scenario D: DTC code in resolved list but maintenance window has specific km range."""
    print("\n" + "="*70)
    print("  SCENARIO D: Multiple DTCs resolved at one service event")
    print("="*70)
    
    vehicle_id = 104
    await cleanup_vehicle_data(vehicle_id)
    
    # Single maintenance event that resolved multiple DTCs
    db = get_mongo_db()
    await db.maintenance_records.insert_one({
        "vehicle_id": vehicle_id,
        "component": "general_service",
        "serviced_at_odometer": 148000.0,
        "valid_for_km": 4000.0,
        "resolved_dtc_codes": ["P0171", "P0420", "P0562"],
        "note": "General service resolved multiple issues",
    })
    
    # Current odometer: 150000 km (within valid window: 148000 + 4000)
    await insert_telemetry(vehicle_id, odometer=150000, battery_voltage=12.8, engine_temp=90.0, intake_temp=30.0)
    await insert_dtc_events(
        vehicle_id,
        [
            {"code": "P0171", "description": "Melange trop pauvre", "severity": "warning"},
            {"code": "P0420", "description": "Efficacite du catalyseur sous le seuil", "severity": "warning"},
            {"code": "P0562", "description": "Tension systeme faible", "severity": "critical"},
        ],
    )

    prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
    
    enriched = RecommendationEngine.enrich_prediction(prediction)
    
    print(f"\n  Input:")
    print(f"    - Current odometer: 150000 km")
    print(f"    - Service at: 148000 km (2000 km ago)")
    print(f"    - Valid for: 4000 km (expires at 152000 km)")
    print(f"    - Active DTCs: P0171, P0420, P0562")
    print(f"    - All resolved at this single service")
    
    print(f"\n  Result:")
    print(f"    - Predicted Risks: {len(enriched.get('predicted_risks', []))}")

    risk_messages = " ".join(str(r.get("message")) for r in enriched.get("predicted_risks", []))
    has_dtc_target = any(code in risk_messages for code in ["P0171", "P0420", "P0562"])

    if not has_dtc_target:
        print(f"\n  ✓ PASS: All DTC alerts suppressed (all resolved in recent service)")
        return True
    else:
        print(f"\n  ✗ FAIL: Some alerts not suppressed")
        for risk in enriched.get('predicted_risks', []):
            print(f"    - {risk['type']}: {risk['message']}")
        return False


async def main():
    print("\n" + "="*70)
    print("  COMPREHENSIVE MAINTENANCE SUPPRESSION TEST SUITE")
    print("="*70)
    print("\n  Testing database-driven maintenance records functionality")
    print("  All maintenance_records are now fetched from MongoDB automatically")
    
    results = []
    
    try:
        results.append(("Scenario A", await scenario_a()))
        results.append(("Scenario B", await scenario_b()))
        results.append(("Scenario C", await scenario_c()))
        results.append(("Scenario D", await scenario_d()))
    finally:
        # Cleanup
        for vehicle_id in [101, 102, 103, 104]:
            await cleanup_vehicle_data(vehicle_id)
    
    # Summary
    print("\n" + "="*70)
    print("  TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\n  Overall: {passed}/{total} scenarios passed")
    
    if passed == total:
        print("\n  ✓ All database-driven maintenance record tests passed!")
    else:
        print(f"\n  ⚠ {total - passed} test(s) failed")


if __name__ == "__main__":
    asyncio.run(main())
