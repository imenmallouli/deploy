"""
test_battery_suppression_direct.py — Direct test of battery risk suppression via maintenance records.

This test validates that battery risks are correctly suppressed when maintenance records 
show recent battery service within the validity window.

Usage:
    python backend/scripts/test_battery_suppression_direct.py
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


async def test_battery_suppression():
    """Test that battery risks are suppressed when component is recently serviced."""
    print("\n" + "="*70)
    print("  TEST: Battery Risk Suppression via Maintenance Records")
    print("="*70)
    
    vehicle_id = 201
    db = get_mongo_db()
    
    # Cleanup
    await db.maintenance_records.delete_many({"vehicle_id": vehicle_id})
    await db.telemetry_data.delete_many({"vehicle_id": vehicle_id})
    
    # Insert maintenance record: battery service
    print("\n[Setup] Inserting battery maintenance record...")
    await db.maintenance_records.insert_one({
        "vehicle_id": vehicle_id,
        "component": "battery_system",
        "serviced_at_odometer": 99200.0,
        "valid_for_km": 5000.0,
        "resolved_dtc_codes": ["P0562"],
        "note": "Battery replaced and tested",
    })
    print("  ✓ Maintenance record inserted: battery_system @ 99200 km (valid 5000 km)")
    
    # Insert telemetry with LOW battery voltage (11.2V)
    print("\n[Setup] Inserting telemetry with LOW battery (11.2V)...")
    await db.telemetry_data.insert_one({
        "vehicle_id": vehicle_id,
        "plate": "TEST-201",
        "ts": datetime.now(timezone.utc),
        "speed": 60.0,
        "rpm": 2000.0,
        "fuel_level": 50.0,
        "engine_temp": 90.0,  # Normal temp
        "battery_voltage": 11.2,  # VERY LOW - should trigger battery risk
        "engine_load": 40.0,
        "ambient_air_temp": 25.0,
        "intake_temp": 30.0,
        "odometer": 100000.0,  # Within battery service validity window (99200 + 5000 = 104200)
        "temp_cpu": 65.0,
        "cpu": 35.0,
        "gpu": 15.0,
    })
    print("  ✓ Telemetry inserted: battery_voltage=11.2V @ 100000 km")
    
    # Get prediction
    print("\n[Prediction] Calling predict_latest_for_vehicle...")
    prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
    
    print(f"  - Vehicle ID: {prediction['vehicle_id']}")
    print(f"  - Severity: {prediction['predicted_severity']}")
    print(f"  - Risk Score: {prediction['predicted_risk_score']}")
    print(f"  - Maintenance Records: {len(prediction['maintenance_records'])} record(s)")
    
    if prediction['maintenance_records']:
        for mr in prediction['maintenance_records']:
            print(f"    * {mr['component']} @ {mr['serviced_at_odometer']} km")
    
    # Enrich with recommendations
    print("\n[Enrichment] Processing with RecommendationEngine...")
    enriched = RecommendationEngine.enrich_prediction(prediction)
    
    print(f"  - Maintenance Required: {enriched['maintenance_status']['maintenance_required']}")
    print(f"  - Maintenance Type: {enriched['maintenance_status']['maintenance_type']}")
    print(f"  - Priority: {enriched['maintenance_status']['priority']}")
    
    # Count battery risks
    battery_risks = [r for r in enriched.get('predicted_risks', []) if r['type'] == 'battery']
    thermal_risks = [r for r in enriched.get('predicted_risks', []) if r['type'] in ['cooling', 'thermal_delta']]
    
    print(f"\n[Results]")
    print(f"  - Total Risks: {len(enriched.get('predicted_risks', []))}")
    print(f"  - Battery Risks: {len(battery_risks)}")
    print(f"  - Thermal Risks: {len(thermal_risks)}")
    print(f"  - Other Risks: {len(enriched.get('predicted_risks', [])) - len(battery_risks) - len(thermal_risks)}")
    
    if len(battery_risks) > 0:
        print(f"\n  ✗ FAIL: Battery risks found (should be suppressed)")
        for risk in battery_risks:
            print(f"    - {risk['message']}")
        return False
    else:
        print(f"\n  ✓ PASS: Battery risks were suppressed!")
        print(f"    Battery service was recent (800 km into 5000 km validity window)")
        if thermal_risks:
            print(f"    Note: Thermal risks ({len(thermal_risks)}) are separate, rule-based alerts")
        return True


async def test_battery_alert_when_expired():
    """Test that battery risks ARE NOT suppressed when maintenance window has expired."""
    print("\n" + "="*70)
    print("  TEST: Battery Risk NOT Suppressed When Maintenance Expired")
    print("="*70)
    
    vehicle_id = 202
    db = get_mongo_db()
    
    # Cleanup
    await db.maintenance_records.delete_many({"vehicle_id": vehicle_id})
    await db.telemetry_data.delete_many({"vehicle_id": vehicle_id})
    
    # Insert EXPIRED maintenance record
    print("\n[Setup] Inserting EXPIRED battery maintenance record...")
    await db.maintenance_records.insert_one({
        "vehicle_id": vehicle_id,
        "component": "battery_system",
        "serviced_at_odometer": 95000.0,  # Old service
        "valid_for_km": 3000.0,  # Expires at 98000 km
        "resolved_dtc_codes": ["P0562"],
        "note": "Old battery service",
    })
    print("  ✓ Record inserted: battery_system @ 95000 km (expires at 98000 km)")
    
    # Insert telemetry with LOW battery voltage at CURRENT km > expiry
    print("\n[Setup] Inserting telemetry with LOW battery @ 100000 km (OUTSIDE validity)...")
    await db.telemetry_data.insert_one({
        "vehicle_id": vehicle_id,
        "plate": "TEST-202",
        "ts": datetime.now(timezone.utc),
        "speed": 60.0,
        "rpm": 2000.0,
        "fuel_level": 50.0,
        "engine_temp": 90.0,
        "battery_voltage": 11.2,  # LOW battery
        "engine_load": 40.0,
        "ambient_air_temp": 25.0,
        "intake_temp": 30.0,
        "odometer": 100000.0,  # OUTSIDE window (100000 > 98000)
        "temp_cpu": 65.0,
        "cpu": 35.0,
        "gpu": 15.0,
    })
    print("  ✓ Telemetry inserted: battery_voltage=11.2V @ 100000 km")
    
    # Get prediction
    print("\n[Prediction] Calling predict_latest_for_vehicle...")
    prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id)
    
    # Enrich
    print("\n[Enrichment] Processing with RecommendationEngine...")
    enriched = RecommendationEngine.enrich_prediction(prediction)
    
    battery_risks = [r for r in enriched.get('predicted_risks', []) if r['type'] == 'battery']
    
    print(f"\n[Results]")
    print(f"  - Total Risks: {len(enriched.get('predicted_risks', []))}")
    print(f"  - Battery Risks: {len(battery_risks)}")
    
    if len(battery_risks) > 0:
        print(f"\n  ✓ PASS: Battery risks found (should NOT be suppressed due to expired window)")
        for risk in battery_risks:
            print(f"    - {risk['message']}")
        return True
    else:
        print(f"\n  ✗ FAIL: Battery risks were suppressed (should NOT have been - window expired)")
        return False


async def main():
    print("\n" + "="*70)
    print("  BATTERY SUPPRESSION TEST SUITE")
    print("="*70)
    print("\n  Testing maintenance-based risk suppression for battery component")
    
    results = []
    db = get_mongo_db()
    
    try:
        results.append(("Battery Suppression (Active)", await test_battery_suppression()))
        results.append(("Battery Not Suppressed (Expired)", await test_battery_alert_when_expired()))
    finally:
        # Cleanup
        for vehicle_id in [201, 202]:
            await db.maintenance_records.delete_many({"vehicle_id": vehicle_id})
            await db.telemetry_data.delete_many({"vehicle_id": vehicle_id})
    
    # Summary
    print("\n" + "="*70)
    print("  TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\n  Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n  ✓ Database-driven maintenance suppression is working correctly!")


if __name__ == "__main__":
    asyncio.run(main())
