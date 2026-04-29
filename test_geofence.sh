#!/bin/bash

BASE_URL="http://127.0.0.1:8000"
EMAIL="imen.mallouli@malloulinova.com"
PASSWORD="hellohello"
VEHICLE_ID=1

echo "====== TEST GEOFENCE DETECTION ======"
echo ""

# 1. Login
echo "1️⃣ Authentification..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | /c/auto\ diagnostic\ platform/.venv/Scripts/python -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token vide!"
  exit 1
fi

echo "✅ Token reçu: ${TOKEN:0:20}..."
echo ""

# 2. Position INSIDE zone
echo "2️⃣ Envoi position INSIDE la zone (34.7855, 10.7205)..."
curl -s -X POST "$BASE_URL/api/v1/geofences/vehicle-positions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicle_id\":$VEHICLE_ID,\"latitude\":34.7855,\"longitude\":10.7205}" | /c/auto\ diagnostic\ platform/.venv/Scripts/python -m json.tool

echo ""
sleep 2

# 3. Position OUTSIDE zone
echo "3️⃣ Envoi position OUTSIDE la zone (34.7900, 10.7300)..."
curl -s -X POST "$BASE_URL/api/v1/geofences/vehicle-positions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicle_id\":$VEHICLE_ID,\"latitude\":34.7900,\"longitude\":10.7300}" | /c/auto\ diagnostic\ platform/.venv/Scripts/python -m json.tool

echo ""
echo "====== VÉRIFICATION DES LOGS ======"
echo "Cherche: [EMAIL] Geofence exit notification sent to..."
echo ""
docker compose logs backend --tail 50 | grep -iE "email|geofence|exit" || echo "⚠️  Aucun log trouvé"
