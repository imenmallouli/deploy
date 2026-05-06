import asyncio, sys, traceback
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from app.db.session import SessionLocal
from app.models.alert import Alert

print("Testing direct DB insert...")
db = SessionLocal()
try:
    alert = Alert(
        vehicle_id=4,
        type="geofence_exit",
        severity="warning",
        title="Test sortie zone",
        message="Test message debug",
        status="pending",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    print("SUCCESS - alert id:", alert.id)
    # cleanup
    db.delete(alert)
    db.commit()
    print("Cleaned up.")
except Exception as e:
    db.rollback()
    print("EXCEPTION:")
    traceback.print_exc()
finally:
    db.close()
