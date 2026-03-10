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

---

## 3) Étape A — Démarrer un broker MQTT

Option simple avec Docker (Mosquitto):

```bash
docker run -d --name mqtt-broker -p 1883:1883 eclipse-mosquitto:2
```

Vérifier:

```bash
docker ps
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