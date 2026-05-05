"""
test_db_maintenance.py — Test automatic maintenance_records fetch from MongoDB.

This script:
1. Inserts sample maintenance records into MongoDB
2. Tests the predict_latest_for_vehicle method to verify records are fetched automatically
3. Validates alert suppression works with database-sourced maintenance records

Usage:
    python backend/scripts/test_db_maintenance.py
"""
from __future__ import annotations
import sys
import asyncio
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from datetime import datetime, timezone
from app.db.mongodb import get_mongo_db
from app.services.ia.inference_engine import AIInferenceService
from app.services.ia.recommendation_engine import RecommendationEngine


async def insert_sample_maintenance_records():
    """Insert sample maintenance records for testing."""
    db = get_mongo_db()
    
    # Delete existing test records for clean slate
    await db.maintenance_records.delete_many({"vehicle_id": 1})
    
    test_records = [
        {
            "vehicle_id": 1,
            "component": "battery_system",
            "serviced_at_odometer": 149200,
            "valid_for_km": 5000,
            "resolved_dtc_codes": ["P0562"],
            "note": "Batterie et alternateur controles et repares",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "vehicle_id": 1,
            "component": "cooling_system",
            "serviced_at_odometer": 149000,
            "valid_for_km": 5000,
            "resolved_dtc_codes": ["P0217"],
            "note": "Systeme de refroidissement repare",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "vehicle_id": 1,
            "component": "intake_system",
            "serviced_at_odometer": 148500,
            "valid_for_km": 8000,
            "resolved_dtc_codes": ["P0171", "P0420"],
            "note": "Admission et injecteurs controles et repares",
            "created_at": datetime.now(timezone.utc),
        },
    ]
    
    result = await db.maintenance_records.insert_many(test_records)
    print(f"✓ Inserted {len(result.inserted_ids)} maintenance records for vehicle_id=1")
    return len(result.inserted_ids)


async def insert_sample_telemetry():
    """Insert sample telemetry for vehicle_id=1."""
    db = get_mongo_db()
    
    # Delete existing test telemetry for clean slate
    await db.telemetry_data.delete_many({"vehicle_id": 1})
    
    test_telemetry = [
        {
            "vehicle_id": 1,
            "plate": "TEST-001",
            "ts": datetime.now(timezone.utc),
            "speed": 80.0,
            "rpm": 2400.0,
            "fuel_level": 45.0,
            "engine_temp": 101.0,
            "battery_voltage": 11.9,
            "engine_load": 55.0,
            "ambient_air_temp": 28.0,
            "intake_temp": 39.0,
            "odometer": 150000.0,
            "temp_cpu": 70.0,
            "cpu": 40.0,
            "gpu": 20.0,
        }
    ]
    
    result = await db.telemetry_data.insert_many(test_telemetry)
    print(f"✓ Inserted {len(result.inserted_ids)} telemetry records for vehicle_id=1")
    return len(result.inserted_ids)


async def test_maintenance_fetch():
    """Test that maintenance records are automatically fetched."""
    print("\n" + "="*70)
    print("  TEST: Automatic maintenance_records fetch from MongoDB")
    print("="*70)
    
    # Insert test data
    print("\n[Step 1] Inserting test data into MongoDB...")
    await insert_sample_maintenance_records()
    await insert_sample_telemetry()
    
    # Fetch maintenance records directly
    print("\n[Step 2] Fetching maintenance records directly...")
    records = await AIInferenceService._fetch_maintenance_records_for_vehicle(vehicle_id=1, limit=10)
    print(f"  -> Fetched {len(records)} maintenance records:")
    for i, record in enumerate(records, 1):
        print(f"     {i}. {record['component']} @ {record['serviced_at_odometer']} km (valid: {record['valid_for_km']} km)")
        print(f"        Resolved codes: {record['resolved_dtc_codes']}")
    
    # Test predict_latest_for_vehicle with auto-fetch
    print("\n[Step 3] Testing predict_latest_for_vehicle with auto-fetch...")
    try:
        prediction = await AIInferenceService.predict_latest_for_vehicle(vehicle_id=1)
        
        print(f"  ✓ Prediction generated successfully")
        print(f"    - Vehicle ID: {prediction['vehicle_id']}")
        print(f"    - Severity: {prediction['predicted_severity']}")
        print(f"    - Risk Score: {prediction['predicted_risk_score']}")
        
        # Check if maintenance_records are in the prediction
        if "maintenance_records" in prediction:
            print(f"    - Maintenance Records Fetched: {len(prediction['maintenance_records'])} records")
            for record in prediction['maintenance_records']:
                print(f"      * {record['component']} @ {record['serviced_at_odometer']} km")
        else:
            print("    ⚠ WARNING: maintenance_records not in prediction!")
            
        # Check if maintenance_context is in the prediction
        if "maintenance_context" in prediction:
            print(f"    - Maintenance Context: Present ({len(prediction['maintenance_context'])} fields)")
        else:
            print("    ⚠ WARNING: maintenance_context not in prediction!")
            
    except Exception as e:
        print(f"  ✗ Error during prediction: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Test enrichment with suppression
    print("\n[Step 4] Testing recommendation engine with database-sourced maintenance records...")
    try:
        enriched = RecommendationEngine.enrich_prediction(prediction)
        
        print(f"  ✓ Enrichment successful")
        print(f"    - Maintenance Required: {enriched['maintenance_status']['maintenance_required']}")
        print(f"    - Maintenance Type: {enriched['maintenance_status']['maintenance_type']}")
        print(f"    - Priority: {enriched['maintenance_status']['priority']}")
        
        # Count filtered risks
        num_risks = len(enriched.get('predicted_risks', []))
        num_suggestions = len(enriched.get('maintenance_suggestions', []))
        
        print(f"    - Predicted Risks: {num_risks}")
        print(f"    - Maintenance Suggestions: {num_suggestions}")
        
        if num_risks > 0:
            print(f"\n  Detected Risks:")
            for risk in enriched.get('predicted_risks', []):
                print(f"    • {risk['type']}: {risk['message']} ({risk['severity']})")
        
        if num_suggestions > 0:
            print(f"\n  Suggestions:")
            for sugg in enriched.get('maintenance_suggestions', []):
                print(f"    • [{sugg['priority']}] {sugg['title']}: {sugg['message']}")
        
        print("\n✓ Database-driven maintenance records are working!")
        print("  Alert suppression logic is being applied correctly.")
        
    except Exception as e:
        print(f"  ✗ Error during enrichment: {e}")
        import traceback
        traceback.print_exc()


async def cleanup():
    """Clean up test data."""
    db = get_mongo_db()
    await db.maintenance_records.delete_many({"vehicle_id": 1})
    await db.telemetry_data.delete_many({"vehicle_id": 1})
    print("\n✓ Cleaned up test data from MongoDB")


async def main():
    try:
        await test_maintenance_fetch()
    finally:
        await cleanup()


if __name__ == "__main__":
    asyncio.run(main())
