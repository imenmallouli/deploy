# Guide MQTT Dongle (FR) — Lire les données et les lier à la plateforme

Ce document explique, étape par étape, comment utiliser le protocole MQTT avec un broker pour récupérer les données d'un dongle OBD et les envoyer vers votre backend Auto Diagnostic Platform.

## 1) Objectif

But: établir ce flux de données:

Dongle OBD -> MQTT Broker -> Bridge MQTT -> API Backend -> Frontend

- Le dongle publie des messages MQTT.
- Le broker distribue les messages selon les topics.
- Un service bridge (Python) lit les topics et pousse les données vers:
  - `POST /api/v1/telemetry`
  - `POST /api/v1/dtc`

---

## 2) Prérequis

- Backend démarré (`docker compose up -d --build` dans `backend/`)
- Frontend optionnel (`npm run dev` dans `frontend-web/`)
- Python env backend actif
- Package MQTT installé:

```bash
pip install paho-mqtt requests
```

### Broker MQTT local du projet

Le broker Mosquitto fait maintenant partie du `docker-compose` backend.

Démarrage et vérification:

```bash
cd "c:\auto diagnostic platform\backend"
docker compose up -d --build
docker compose ps
docker compose logs mqtt
```

Paramètres par défaut:
- Host: `127.0.0.1`
- Port: `1883`
- Auth: anonyme activée en local uniquement

## 2.1) Plan de travail AVANT de brancher le dongle (recommandé)

Quand le dongle n'est pas encore connecté à la voiture, valider d'abord tout le pipeline logiciel:

1. **Backend + DB OK** (Docker up, `/docs` accessible)
2. **Broker MQTT OK** (publish/subscribe local)
3. **Bridge MQTT -> API OK** (`mqtt_gateway.py` en cours d'exécution)
4. **Ingestion API OK** (données visibles via `GET /api/v1/telemetry/{vehicle_id}`)
5. **Frontend OK** (page Telemetry/Diagnostics lit les données)

Si ces 5 points passent, alors quand le dongle réel sera branché, il restera uniquement la partie port/connexion véhicule à résoudre.

### Commandes rapides (sans dongle)

#### A) Démarrer backend

```bash
cd "c:\auto diagnostic platform\backend"
docker compose up -d --build
```

#### B) Démarrer broker MQTT

```bash
cd "c:\auto diagnostic platform\backend"
docker compose up -d mqtt
```

#### C) Lancer le bridge MQTT -> API

```bash
cd "c:\auto diagnostic platform\backend"
.\.venv\Scripts\python.exe .\scripts\mqtt_gateway.py --mqtt-host 127.0.0.1 --mqtt-port 1883 --topic-prefix autodiag/devices --base-url http://127.0.0.1:8000 --email votre_email --password votre_mot_de_passe
```

#### D) Publier des messages de test (telemetry + dtc + heartbeat)

```bash
docker compose exec mqtt sh -c "mosquitto_pub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/telemetry' -m '{\"vehicle_id\":1,\"speed\":62,\"rpm\":2200,\"fuel_level\":45,\"engine_temp\":91,\"battery_voltage\":12.5}'"

docker compose exec mqtt sh -c "mosquitto_pub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/dtc' -m '{\"vehicle_id\":1,\"code\":\"P0300\",\"description\":\"Random/Multiple Cylinder Misfire\",\"severity\":\"warning\"}'"

docker compose exec mqtt sh -c "mosquitto_pub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/heartbeat' -m '{\"device_id\":\"042f5956-5b4e-4f37-9e74-461f1997a567\",\"unit_id\":\"ccb71376-cd13-b201-170e-c917fc1199ff\",\"status\":\"online\"}'"
```

#### E) Vérifier ingestion

```text
GET /api/v1/telemetry/1
GET /api/v1/dtc/1
GET /api/v1/dtc/iot/logs?device_id=ccb71376-cd13-b201-170e-c917fc1199ff
```

> Important: laisser `start` / `end` vides lors des premiers tests (sinon risque de fenêtre temporelle vide).

---

## 3) Étape A — Démarrer un broker MQTT

Option simple avec Docker (Mosquitto):

```bash
cd "c:\auto diagnostic platform\backend"
docker compose up -d mqtt
```

Vérifier:

```bash
docker compose ps
docker compose logs mqtt
```

Broker par défaut:
- Host: `127.0.0.1`
- Port: `1883`

---

## 4) Étape B — Définir les topics (standard projet)

Convention recommandée:

- Télémétrie:
  - `autodiag/devices/{device_id}/telemetry`
- DTC:
  - `autodiag/devices/{device_id}/dtc`
- Heartbeat device:
  - `autodiag/devices/{device_id}/heartbeat`

Exemple avec `device_id = ccb71376`:
- `autodiag/devices/ccb71376/telemetry`
- `autodiag/devices/ccb71376/dtc`
- `autodiag/devices/ccb71376/heartbeat`

### Comment faire cette étape (pratique)

1. Choisir un `device_id` unique (ex: `ccb71376`).
2. Garder le préfixe projet fixe: `autodiag/devices/`.
3. Utiliser exactement ces suffixes:
  - `/telemetry` pour les mesures temps réel
  - `/dtc` pour les codes défaut
  - `/heartbeat` pour l'état du dongle
4. Configurer le dongle/agent publisher avec ces 3 topics.
5. Configurer le bridge pour `subscribe` sur:
  - `autodiag/devices/+/telemetry`
  - `autodiag/devices/+/dtc`
  - `autodiag/devices/+/heartbeat`

### Mapping Topic -> Endpoint Backend

| Topic MQTT | Type de donnée | Endpoint backend |
|---|---|---|
| `autodiag/devices/{device_id}/telemetry` | Télémétrie (speed, rpm, fuel, temp...) | `POST /api/v1/telemetry` |
| `autodiag/devices/{device_id}/dtc` | DTC (`P0xxx`, description, severity...) | `POST /api/v1/dtc` |
| `autodiag/devices/{device_id}/heartbeat` | État device (`online/offline`, timestamp) | `POST /api/v1/dtc/iot/logs` (ou endpoint status dédié si ajouté) |

### Exemple concret (device `ccb71376`)

- Publisher envoie la télémétrie sur `autodiag/devices/ccb71376/telemetry`
- Le bridge reçoit, parse JSON, puis appelle `POST /api/v1/telemetry`
- Publisher envoie les défauts sur `autodiag/devices/ccb71376/dtc`
- Le bridge reçoit, parse JSON, puis appelle `POST /api/v1/dtc`
- Publisher envoie l'état sur `autodiag/devices/ccb71376/heartbeat`
- Le bridge transforme en log IoT et appelle `POST /api/v1/dtc/iot/logs`

### Étape suivante prête à lancer (avec vos IDs réels)

IDs validés:
- `Device ID`: `042f5956-5b4e-4f37-9e74-461f1997a567`
- `Unit ID`: `ccb71376-cd13-b201-170e-c917fc1199ff`

Topics à utiliser:
- `autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/telemetry`
- `autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/dtc`
- `autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/heartbeat`

1) Lancer un subscriber de contrôle (capture 3 messages):

```bash
docker compose exec mqtt sh -c "mosquitto_sub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/#' -C 3 -v"
```

2) Publier les 3 messages de test (telemetry, dtc, heartbeat):

```bash
docker compose exec mqtt sh -c "mosquitto_pub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/telemetry' -m '{\"vehicle_id\":1,\"ts\":\"2026-03-11T12:00:00Z\",\"speed\":58.2,\"rpm\":2100,\"fuel_level\":47.5,\"engine_temp\":92.1,\"battery_voltage\":13.7}'"

docker compose exec mqtt sh -c "mosquitto_pub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/dtc' -m '{\"vehicle_id\":1,\"code\":\"P0300\",\"description\":\"Random/Multiple Cylinder Misfire Detected\",\"severity\":\"warning\",\"last_occurrence\":\"2026-03-11T12:00:10Z\"}'"

docker compose exec mqtt sh -c "mosquitto_pub -h 127.0.0.1 -p 1883 -t 'autodiag/devices/ccb71376-cd13-b201-170e-c917fc1199ff/heartbeat' -m '{\"device_id\":\"042f5956-5b4e-4f37-9e74-461f1997a567\",\"unit_id\":\"ccb71376-cd13-b201-170e-c917fc1199ff\",\"status\":\"online\",\"ts\":\"2026-03-11T12:00:30Z\"}'"
```

3) Résultat attendu:
- Le subscriber affiche les 3 topics avec leurs payloads JSON.
- Si oui, le broker + topics sont corrects et vous pouvez passer au bridge MQTT -> API.

---

## 5) Étape C — Format des messages JSON

## 5.1 Télémetrie

```json
{
  "vehicle_id": 1,
  "ts": "2026-03-09T10:15:00Z",
  "speed": 58.2,
  "rpm": 2100,
  "fuel_level": 47.5,
  "engine_temp": 92.1,
  "battery_voltage": 13.7
}
```

## 5.2 DTC

```json
{
  "vehicle_id": 1,
  "code": "P0300",
  "description": "Random/Multiple Cylinder Misfire Detected",
  "severity": "warning",
  "last_occurrence": "2026-03-09T10:16:10Z"
}
```

## 5.3 Heartbeat

```json
{
  "device_id": "ccb71376",
  "status": "online",
  "ts": "2026-03-09T10:16:30Z"
}
```

---

## 6) Étape D — Tester publish/subscribe rapidement

Si vous avez Mosquitto clients installés:

Subscriber:

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t "autodiag/devices/+/telemetry" -v
```

Publisher (test):

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t "autodiag/devices/ccb71376/telemetry" -m "{\"vehicle_id\":1,\"speed\":40,\"rpm\":1500}"
```

Si le subscriber reçoit le message, le broker fonctionne.

---

## 7) Étape E — Créer le bridge MQTT -> Backend

Exemple de bridge minimal (Python):

```python
import json
import requests
import paho.mqtt.client as mqtt

BASE_URL = "http://127.0.0.1:8000"
TOKEN = "<JWT_TOKEN>"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def post_telemetry(payload: dict):
    r = requests.post(f"{BASE_URL}/api/v1/telemetry", headers=HEADERS, json=payload, timeout=10)
    r.raise_for_status()


def post_dtc(payload: dict):
    r = requests.post(f"{BASE_URL}/api/v1/dtc", headers=HEADERS, json=payload, timeout=10)
    r.raise_for_status()


def on_connect(client, userdata, flags, rc, properties=None):
    client.subscribe("autodiag/devices/+/telemetry", qos=1)
    client.subscribe("autodiag/devices/+/dtc", qos=1)


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except Exception:
        return

    if msg.topic.endswith("/telemetry"):
        post_telemetry(payload)
    elif msg.topic.endswith("/dtc"):
        post_dtc(payload)


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message
client.connect("127.0.0.1", 1883, 60)
client.loop_forever()
```

Ce bridge peut être ajouté plus tard dans `backend/scripts/mqtt_gateway.py`.

Bridge prêt à l'emploi ajouté dans le projet:
- `backend/scripts/mqtt_gateway.py`

Lancement rapide (avec login API):

```bash
cd "c:\auto diagnostic platform\backend"
.\.venv\Scripts\python.exe .\scripts\mqtt_gateway.py \
  --mqtt-host 127.0.0.1 \
  --mqtt-port 1883 \
  --topic-prefix autodiag/devices \
  --base-url http://127.0.0.1:8000 \
  --email votre_email \
  --password votre_mot_de_passe
```

Lancement avec token direct:

```bash
cd "c:\auto diagnostic platform\backend"
.\.venv\Scripts\python.exe .\scripts\mqtt_gateway.py \
  --mqtt-host 127.0.0.1 \
  --mqtt-port 1883 \
  --topic-prefix autodiag/devices \
  --base-url http://127.0.0.1:8000 \
  --token <JWT_TOKEN>
```

Comportement du script:
- `.../telemetry` -> `POST /api/v1/telemetry`
- `.../dtc` -> `POST /api/v1/dtc`
- `.../heartbeat` -> `POST /api/v1/dtc/iot/logs`

---

## 8) Étape F — Lier un device/dongle à la donnée

Règle pratique:
- le topic contient `device_id` (source physique)
- le payload contient `vehicle_id` (cible métier)

Cela permet de tracer:
- quel dongle a envoyé,
- pour quel véhicule la donnée est enregistrée.

---

## 9) Étape G — Vérifier dans votre plateforme

1. API:
- `GET /api/v1/telemetry/{vehicle_id}`
- `GET /api/v1/dtc/{vehicle_id}`

2. Frontend:
- Page Telemetry / Diagnostics
- Page Devices (status + last communication)

---

## 10) Sécurité minimale recommandée (production)

- Activer username/password sur broker
- Utiliser TLS (`8883`) au lieu de `1883`
- Isoler topics par namespace projet
- Valider schéma JSON côté bridge avant POST
- Ajouter retry + dead-letter logs

---

## 11) Erreurs fréquentes

- `Connection refused` MQTT:
  - broker non démarré ou mauvais host/port
- `401` sur API:
  - token JWT absent/expiré
- Données non visibles UI:
  - `vehicle_id` erroné ou filtres actifs
- Message ignoré:
  - topic ne correspond pas aux subscriptions

---

## 12) Plan d'implémentation recommandé (équipe)

1. Valider broker local
2. Standardiser topics + payloads
3. Déployer bridge MQTT -> API
4. Ajouter supervision (logs + métriques)
5. Sécuriser broker (auth/TLS)
6. Tester charge (plusieurs devices)

---

En résumé: MQTT sert de transport temps réel entre dongles et plateforme. Le broker reçoit, le bridge transforme et envoie au backend, puis vos pages frontend lisent les données via API.

---

## 13) Procedure finale de test reel (AutoPi Cloud + dongle voiture)

Objectif: valider que seules les donnees reelles du dongle alimentent la plateforme (sans faux data).

### 13.1 Pre-checks

1. Verifier que la stack est lancee:

```powershell
cd "c:\auto diagnostic platform\backend"
docker compose up -d
docker ps
```

2. Verifier que la gateway est vivante (lecture logs):

```powershell
docker logs -f adp-mqtt-gateway
```

Important: cette commande n'execute pas la gateway, elle affiche seulement les logs.

### 13.2 Configuration AutoPi (obligatoire)

1. Device -> Settings -> Returner MQTT
- Host: `broker.emqx.io`
- Port: `1883`
- Enabled: `True`
- TLS: `False`

2. Device -> Services -> `gnss_manager` (worker `poll_logger`)
- Enabled: `True`
- Auto Start: `True`
- Interval: `5`
- Returner: inclure `mqtt`
- Filter: retirer `significant_position` pendant le test initial

3. Device -> Loggers (OBD-II PID)
- `RPM`, `SPEED`, `ENGINE_LOAD`, `GET_DTC` (au minimum)
- `Enabled` doit etre vert

4. Save + Sync process to device.

### 13.3 Test en conditions reelles

1. Brancher le dongle dans la voiture.
2. Contact ON puis moteur ON.
3. Mettre la voiture en exterieur (GPS fix).
4. Attendre 30 a 120 secondes.

### 13.4 Ce qui doit apparaitre dans les logs gateway

```text
[FORWARD] telemetry OK ... topic=spm/bat
[FORWARD] telemetry OK ... topic=.../track/pos
[GPS] position saved vehicle_id=11 ...
```

Si les topics OBD arrivent aussi:

```text
... topic=.../obd/rpm
... topic=.../obd/speed
... topic=.../obd/engine_load
```

### 13.5 Verification base de donnees

Derniere position GPS:

```powershell
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.vehicle_positions.find({vehicle_id:11},{_id:0,latitude:1,longitude:1,updated_at:1}).sort({$natural:-1}).limit(1).toArray()"
```

Dernieres telemetries (vehicule 11):

```powershell
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.telemetry_data.find({vehicleId:11},{_id:0,timestamp:1,ts:1,speed:1,rpm:1,battery_voltage:1,battery_charge_level:1}).sort({$natural:-1}).limit(10).toArray()"
```

### 13.6 Lecture UI attendue

1. Page Locations:
- Le point dongle (vert) montre la derniere position connue.
- Quand un nouveau `track/pos` arrive, la position se met a jour.

2. Page Diagnostic:
- Si donnees fraiches recues: valeurs live.
- Si flux stale (plus de donnees recentes): valeurs remises a `0`.

### 13.7 Troubleshooting rapide

1. Cas A: `spm/bat` arrive, mais pas `track/pos`
- Revoir `gnss_manager` (filter/returner/sync)
- Verifier GPS fix en exterieur

2. Cas B: `spm/bat` et `track/pos` arrivent, mais pas OBD
- Verifier moteur ON
- Verifier loggers OBD (Active peut rester rouge pour certains PIDs non supportes)
- Tester au minimum RPM/SPEED/ENGINE_LOAD

3. Cas C: rien n'arrive
- Verifier device online dans AutoPi Cloud
- Restart device puis relancer la surveillance logs gateway
