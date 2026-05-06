"""
test_geofence_alert.py — Teste la creation d'alerte in-app lors d'une sortie de geocloture.

Etapes :
1. Cree une geocloture de test (carre autour de Sousse, Tunisie)
2. Simule vehicleId=1 DANS la zone  → aucune alerte
3. Simule vehicleId=1 HORS de la zone → alerte geofence_exit creee
4. Verifie l'alerte en base PostgreSQL
5. Nettoie les donnees de test
"""
from __future__ import annotations
import asyncio
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.mongodb import get_mongo_db
from app.db.session import SessionLocal
from app.models.alert import Alert
from app.services.ops_service import OpsService

# Coordonnees test : centre Sousse
CENTER_LAT = 35.8256
CENTER_LNG = 10.6084
RADIUS_M = 500   # 500 m autour du centre
VEHICLE_ID = 4  # vehicule reel en base (STS-140239)

# Position DANS la zone (decalage ~100 m)
INSIDE_LAT = 35.8256
INSIDE_LNG = 10.6084

# Position HORS de la zone (decalage ~2 km)
OUTSIDE_LAT = 35.8450
OUTSIDE_LNG = 10.6084


async def run_test():
    db = get_mongo_db()
    sql = SessionLocal()

    print("=" * 60)
    print("  TEST ALERTE GEOFENCE IN-APP")
    print("=" * 60)

    # ── Etape 1 : creer une geocloture de test ──────────────────
    print("\n[1] Creation geocloture de test (cercle 500m, Sousse)...")
    result = await db.geofences.insert_one({
        "name": "Zone TEST auto-diagnostic",
        "center_lat": CENTER_LAT,
        "center_lng": CENTER_LNG,
        "radius_m": RADIUS_M,
        "enabled": True,
    })
    geofence_id = str(result.inserted_id)
    print(f"    -> geofence_id={geofence_id}")

    # Nettoyer l'etat precedent pour ce vehicule / geocloture
    await db.geofence_vehicle_state.delete_many({"vehicle_id": VEHICLE_ID, "geofence_id": geofence_id})

    # ── Etape 2 : position DANS la zone ────────────────────────
    print(f"\n[2] Simulation position DANS la zone ({INSIDE_LAT}, {INSIDE_LNG})...")
    alerts_before = sql.query(Alert).filter(
        Alert.type == "geofence_exit",
        Alert.vehicle_id == VEHICLE_ID,
    ).count()

    await OpsService.check_geofences(INSIDE_LAT, INSIDE_LNG, vehicle_id=VEHICLE_ID)

    alerts_after_inside = sql.query(Alert).filter(
        Alert.type == "geofence_exit",
        Alert.vehicle_id == VEHICLE_ID,
    ).count()

    new_inside = alerts_after_inside - alerts_before
    inside_ok = new_inside == 0
    print(f"    -> Nouvelles alertes geofence_exit : {new_inside}  {'OK' if inside_ok else 'FAIL (attendu 0)'}")

    # ── Etape 3 : position HORS de la zone ─────────────────────
    print(f"\n[3] Simulation position HORS de la zone ({OUTSIDE_LAT}, {OUTSIDE_LNG})...")
    await OpsService.check_geofences(OUTSIDE_LAT, OUTSIDE_LNG, vehicle_id=VEHICLE_ID)

    # Refresh session
    sql.expire_all()
    alerts_after_exit = sql.query(Alert).filter(
        Alert.type == "geofence_exit",
        Alert.vehicle_id == VEHICLE_ID,
    ).count()

    new_exit = alerts_after_exit - alerts_after_inside
    exit_ok = new_exit == 1
    print(f"    -> Nouvelles alertes geofence_exit : {new_exit}  {'OK' if exit_ok else 'FAIL (attendu 1)'}")

    if new_exit > 0:
        alert = sql.query(Alert).filter(
            Alert.type == "geofence_exit",
            Alert.vehicle_id == VEHICLE_ID,
        ).order_by(Alert.id.desc()).first()
        print(f"\n    Alerte creee :")
        print(f"      id       : {alert.id}")
        print(f"      title    : {alert.title}")
        print(f"      message  : {alert.message}")
        print(f"      severity : {alert.severity}")
        print(f"      status   : {alert.status}")
        print(f"      created  : {alert.created_at}")

    # ── Etape 4 : nettoyage ─────────────────────────────────────
    print("\n[4] Nettoyage des donnees de test...")
    deleted_alerts = sql.query(Alert).filter(
        Alert.type == "geofence_exit",
        Alert.vehicle_id == VEHICLE_ID,
    ).delete()
    sql.commit()

    await db.geofences.delete_one({"_id": result.inserted_id})
    await db.geofence_vehicle_state.delete_many({"vehicle_id": VEHICLE_ID})
    await db.geofence_events.delete_many({"vehicle_id": VEHICLE_ID})

    print(f"    -> {deleted_alerts} alerte(s) supprimee(s), geocloture supprimee.")

    # ── Resultat final ──────────────────────────────────────────
    print(f"\n{'=' * 60}")
    overall = inside_ok and exit_ok
    print(f"  Resultat : {'PASS' if overall else 'FAIL'}")
    if not inside_ok:
        print("  FAIL: alerte creee alors que le vehicule etait DANS la zone")
    if not exit_ok:
        print("  FAIL: aucune alerte creee a la sortie de zone")
    print("=" * 60)

    sql.close()


if __name__ == "__main__":
    asyncio.run(run_test())
