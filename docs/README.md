# auto-diagnostic-platform
Platform for remote and intelligent auto diagnostic
Location: C:\auto diagnostic platform\backend\.venv\Lib\site-packages





```bash
cd "/c/auto diagnostic platform/backend"
bash ./scripts/docker-up.sh
```
puis :
```bash
cd "c:\auto diagnostic platform\frontend-web"
npm run dev
```






cd "C:\auto diagnostic platform\backend"
docker compose up -d --build
docker compose ps
cd "C:\auto diagnostic platform\frontend-web"
npm run dev

## MQTT local (Mosquitto)

Le broker MQTT local fait maintenant partie du `docker-compose` backend.

Après `docker compose up -d --build`, vérifier:

```bash
cd "C:\auto diagnostic platform\backend"
docker compose ps
docker compose logs mqtt
```

Broker local par défaut:

- Host: `127.0.0.1`
- Port: `1883`

Test rapide:

```bash
docker compose exec mqtt mosquitto_sub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/#' -C 1 -v
```

Dans un autre terminal:

```bash
docker compose exec mqtt mosquitto_pub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/test-device/heartbeat' -m '{"device_id":"test-device","status":"online"}'
```

## OBD Gateway MVP

Pour lire un dongle ELM327 et envoyer les données vers `/api/v1/telemetry` et `/api/v1/dtc`, voir:

- `docs/obd_gateway_mvp.md`

## Guide Device / Dongle

Pour travailler la partie Device (dongle) étape par étape, voir:

- `docs/README_device_dongle.md`

## Guide MQTT / Broker / Dongle (FR)

Pour la partie MQTT (broker, topics, liaison données dongle vers backend) en détail:

- `docs/README_mqtt_dongle_fr.md`






# Terminal 1 — démarrer tous les services
cd "C:\auto diagnostic platform\backend"
docker compose up -d --build

# Terminal 2 — lancer le client MQTT
cd "C:\auto diagnostic platform\gateway"
python mqtt_client.py

# Terminal 3 — frontend (optionnel)
cd "C:\auto diagnostic platform\frontend-web"
npm run dev




# traint model 
"/c/auto diagnostic platform/backend/.venv/Scripts/python.exe" "scripts/train_alert_model.py"

# test model
"/c/auto diagnostic platform/backend/.venv/Scripts/python.exe" "scripts/test_model.py"



# lancer test 
## Démarrer les conteneurs
cd "/c/auto diagnostic platform/backend"
docker compose up -d
## Copier les scripts de test dans le backend container à refaire après rebuild/recreate
cd "/c/auto diagnostic platform"

docker cp backend/scripts/simulate_live_vehicle_stream.py adp-backend:/app/scripts/
docker cp backend/scripts/run_vehicle11_2min_stream.py adp-backend:/app/scripts/

 ## Lancer le stream de test (vehicle 11) en arrière-plan

cd "/c/auto diagnostic platform"

docker exec -d adp-backend sh -lc "nohup python scripts/run_vehicle11_2min_stream.py >> /tmp/stream.log 2>&1 &"
 ## Vérifier que le test tourne
 cd "/c/auto diagnostic platform"

docker exec adp-backend sh -lc "tail -n 20 /tmp/stream.log"

## Vérifier que des DTC existent pour vehicle 11
cd "/c/auto diagnostic platform"

docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.dtc_events.countDocuments({vehicle_id:11})"

## Arrêter le test
cd "/c/auto diagnostic platform"

docker exec adp-backend pkill -f run_vehicle11_2min_stream.py


# 1. Aller au répertoire du projet
cd /c/auto\ diagnostic\ platform

# 2. Démarrer les services (si pas déjà lancés)
docker compose -f backend/docker-compose.yml up -d

# 3. Attendre 10 secondes que les services démarrent
sleep 10

# 4. Copier les scripts du simulateur dans le conteneur
docker cp backend/scripts/simulate_live_vehicle_stream.py adp-backend:/app/scripts/
docker cp backend/scripts/run_vehicle11_2min_stream.py adp-backend:/app/scripts/

# 5. Lancer le flux de données EN ARRIÈRE-PLAN
docker exec -d adp-backend sh -lc "nohup python scripts/run_vehicle11_2min_stream.py >> /tmp/stream.log 2>&1 &"

# 6. Attendre 5 secondes, puis voir les logs du flux
sleep 5
docker exec adp-backend sh -lc "tail -n 30 /tmp/stream.log"



# Vérifier les DTC
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.dtc_events.countDocuments({vehicle_id:11})"

# Vérifier les alertes
docker exec adp-postgres psql -U autopi_user -d mallouliauto -c "SELECT COUNT(*) FROM alerts WHERE vehicle_id = 11;"

# Vérifier la télémétrie
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.telemetry_data.countDocuments({vehicle_id:11})"


# Vérifier les DTC
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.dtc_events.countDocuments({vehicle_id:11})"

# Vérifier les alertes
docker exec adp-postgres psql -U autopi_user -d mallouliauto -c "SELECT COUNT(*) FROM alerts WHERE vehicle_id = 11;"

# Vérifier la télémétrie
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.telemetry_data.countDocuments({vehicle_id:11})"

# Vérifier les DTC
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.dtc_events.countDocuments({vehicle_id:11})"

# Vérifier les alertes
docker exec adp-postgres psql -U autopi_user -d mallouliauto -c "SELECT COUNT(*) FROM alerts WHERE vehicle_id = 11;"

# Vérifier la télémétrie
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.telemetry_data.countDocuments({vehicle_id:11})"

# Arrêter le test
docker exec adp-backend sh -lc "pkill -f run_vehicle11_2min_stream.py"