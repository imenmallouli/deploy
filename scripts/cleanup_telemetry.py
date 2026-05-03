#!/usr/bin/env python3
"""
Remove temp_cpu, cpu, gpu fields from all telemetry documents in MongoDB
"""
import sys
from pymongo import MongoClient

def cleanup_telemetry():
    """Remove cpu-related fields from telemetry collection"""
    mongo_url = "mongodb://localhost:27017"
    client = MongoClient(mongo_url)
    
    try:
        db = client["auto_diagnostic"]
        telemetry = db["telemetry"]
        realtime = db["realtime"]
        
        print("🧹 Cleaning telemetry collection...")
        
        # Remove fields from telemetry collection
        result_telemetry = telemetry.update_many(
            {},
            {
                "$unset": {
                    "temp_cpu": "",
                    "cpu": "",
                    "gpu": ""
                }
            }
        )
        print(f"  ✓ Telemetry: {result_telemetry.modified_count} documents updated")
        
        # Remove fields from realtime collection
        print("🧹 Cleaning realtime collection...")
        result_realtime = realtime.update_many(
            {},
            {
                "$unset": {
                    "metrics.temp_cpu": "",
                    "metrics.cpu": "",
                    "metrics.gpu": ""
                }
            }
        )
        print(f"  ✓ Realtime: {result_realtime.modified_count} documents updated")
        
        print("\n✅ Cleanup complete! Old fields removed from database.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    cleanup_telemetry()
