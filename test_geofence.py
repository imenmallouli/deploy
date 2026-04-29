#!/usr/bin/env python
import requests
import json
import subprocess
import time

BASE_URL = "http://127.0.0.1:8000"
EMAIL = "imen.mallouli@malloulinova.com"
PASSWORD = "hellohello"
VEHICLE_ID = 1

print("====== TEST GEOFENCE DETECTION ======\n")

# 1. Login
print("1️⃣ Authentification...")
try:
    response = requests.post(f"{BASE_URL}/api/v1/auth/login", 
        json={"email": EMAIL, "password": PASSWORD})
    token = response.json().get("access_token")
    if not token:
        print("❌ Erreur: Token vide!")
        exit(1)
    print(f"✅ Token reçu: {token[:20]}...")
except Exception as e:
    print(f"❌ Erreur auth: {e}")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}
print()

# 2. Position INSIDE zone
print("2️⃣ Envoi position INSIDE la zone (34.7855, 10.7205)...")
try:
    response = requests.post(f"{BASE_URL}/api/v1/geofences/vehicle-positions",
        json={"vehicle_id": VEHICLE_ID, "latitude": 34.7855, "longitude": 10.7205},
        headers=headers)
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"❌ Erreur: {e}")

print()
time.sleep(2)

# 3. Position OUTSIDE zone
print("3️⃣ Envoi position OUTSIDE la zone (34.7900, 10.7300)...")
try:
    response = requests.post(f"{BASE_URL}/api/v1/geofences/vehicle-positions",
        json={"vehicle_id": VEHICLE_ID, "latitude": 34.7900, "longitude": 10.7300},
        headers=headers)
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"❌ Erreur: {e}")

print()
print("====== VÉRIFICATION DES LOGS ======")
print("Cherche: [EMAIL] Geofence exit notification sent to...")
print()

try:
    result = subprocess.run(
        ["docker", "compose", "logs", "backend", "--tail", "50"],
        capture_output=True, text=True, cwd=".")
    logs = result.stdout
    
    # Find lines with EMAIL or geofence
    relevant_logs = [line for line in logs.split('\n') 
                    if 'email' in line.lower() or 'geofence' in line.lower() or 'exit' in line.lower()]
    
    if relevant_logs:
        for line in relevant_logs:
            print(line)
    else:
        print("⚠️  Aucun log d'email trouvé")
except Exception as e:
    print(f"❌ Erreur logs: {e}")
