# Guide complet — Pipeline MQTT AutoPi → Auto Diagnostic Platform

Ce document décrit toutes les étapes réalisées pour relier un dongle AutoPi à la plateforme
de diagnostic via le protocole MQTT. Il couvre l'architecture, la configuration cloud,
le lancement du bridge, la vérification des données et le dépannage.

---

## Table des matières

1. [Architecture globale](#1-architecture-globale)
2. [Prérequis](#2-prérequis)
3. [Démarrage de l'infrastructure Docker](#3-démarrage-de-linfrastructure-docker)
4. [Création du compte utilisateur backend](#4-création-du-compte-utilisateur-backend)
5. [Configuration AutoPi Cloud](#5-configuration-autopi-cloud)
6. [Lancement du bridge MQTT (mqtt_gateway.py)](#6-lancement-du-bridge-mqtt-mqtt_gatewaypy)
7. [Topics MQTT et format des payloads](#7-topics-mqtt-et-format-des-payloads)
8. [Correspondance OBD → champs télémétrie](#8-correspondance-obd--champs-télémétrie)
9. [Endpoints API appelés par le bridge](#9-endpoints-api-appelés-par-le-bridge)
10. [Vérification des données ingérées](#10-vérification-des-données-ingérées)
11. [Connexion OBD véhicule (étape finale)](#11-connexion-obd-véhicule-étape-finale)
12. [Dépannage — Erreurs rencontrées et solutions](#12-dépannage--erreurs-rencontrées-et-solutions)
13. [Résumé du pipeline validé](#13-résumé-du-pipeline-validé)

---

## 1. Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        HARDWARE                                  │
│  Dongle AutoPi  ──── OBD-II port  ────  Véhicule (12V CAN bus) │
└────────────────────────────┬────────────────────────────────────┘
                             │ 4G/WiFi
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOPI CLOUD (autopi.io)                       │
│  Loggers (RPM, SPEED, FUEL…) ──► MQTT Returner                  │
│  Reactor (events) ──────────────► MQTT Returner                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ MQTT publish (broker.emqx.io:1883)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              MQTT BROKER PUBLIC (broker.emqx.io)                 │
│  Topics: obd/#  spm/bat  track/pos  acc/xyz  reactor  rpi/temp  │
└────────────────────────────┬────────────────────────────────────┘
                             │ MQTT subscribe
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           BRIDGE  backend/scripts/mqtt_gateway.py                │
│  - Authentification JWT via /api/v1/auth/login                   │
│  - Décodage @t / @ts du payload AutoPi                          │
│  - Routage vers le bon endpoint REST                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           BACKEND FASTAPI  (docker: adp-backend:8000)            │
│  POST /api/v1/telemetry   →  MongoDB (télémétrie)               │
│  POST /api/v1/dtc         →  MongoDB (codes DTC)                │
│  POST /api/v1/dtc/iot/logs→  MongoDB (événements IoT)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴───────────────┐
              ▼                              ▼
┌───────────────────────┐     ┌──────────────────────────┐
│  PostgreSQL (adp-      │     │  MongoDB (adp-mongo)      │
│  postgres:5432)        │     │  télémétrie, DTC, IoT logs│
│  users, véhicules,     │     └──────────────────────────┘
│  flottes, alertes      │
└───────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│          FRONTEND WEB  (frontend-web/ — React + Vite)            │
│  Pages: Dashboard, Telemetry, DTC, Devices, Fleets, Alerts…     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Prérequis

| Outil | Version | Rôle |
|---|---|---|
| Docker Desktop | 4.x+ | Faire tourner backend + DB + MQTT local |
| Python | 3.11+ | Bridge mqtt_gateway.py |
| paho-mqtt | 2.x | Client MQTT Python |
| requests | 2.x | Appels REST vers le backend |
| Git Bash (ou PowerShell) | — | Lancer les commandes |

### Installation des dépendances Python

```bash
cd "c:\auto diagnostic platform\backend"
# Activer l'environnement virtuel
source ../.venv/Scripts/activate          # Git Bash
# ou
& "..\..\.venv\Scripts\Activate.ps1"      # PowerShell

pip install paho-mqtt requests
```

---

## 3. Démarrage de l'infrastructure Docker

Le fichier `backend/docker-compose.yml` démarre 4 conteneurs :

| Conteneur | Image | Port | Rôle |
|---|---|---|---|
| `adp-backend` | FastAPI Python 3.11 | 8000 | API REST |
| `adp-postgres` | PostgreSQL 16 | 5432 | DB relationnelle |
| `adp-mongo` | MongoDB 7 | 27017 | DB NoSQL (télémétrie) |
| `adp-mqtt` | Eclipse Mosquitto 2 | 1883 | Broker MQTT local |

### Commandes

```bash
# Git Bash
cd "/c/auto diagnostic platform/backend"
docker compose up -d --build

# Vérifier que les 4 conteneurs sont healthy
docker compose ps
```

Sortie attendue :
```
NAME            STATUS          PORTS
adp-backend     Up (healthy)    0.0.0.0:8000->8000/tcp
adp-mongo       Up (healthy)    0.0.0.0:27017->27017/tcp
adp-mqtt        Up              0.0.0.0:1883->1883/tcp
adp-postgres    Up (healthy)    0.0.0.0:5432->5432/tcp
```

> **Problème courant :** si Docker Desktop n'est pas démarré, l'erreur suivante apparaît :
> `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`
>
> **Solution :** ouvrir Docker Desktop manuellement, attendre 30 s, puis relancer `docker compose up -d`.

---

## 4. Création du compte utilisateur backend

Le bridge s'authentifie contre l'API backend. Un compte doit exister en base avant de lancer le bridge.

### Via PowerShell

```powershell
$body = '{
  "first_name": "Imen",
  "last_name":  "Mallouli",
  "email":      "imen.mallouli@malloulinova.com",
  "role":       "admin",
  "phone":      "00000000",
  "password":   "hellohello"
}'
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8000/api/v1/auth/register" `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 6
```

### Via curl (Git Bash)

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Imen",
    "last_name":  "Mallouli",
    "email":      "imen.mallouli@malloulinova.com",
    "role":       "admin",
    "phone":      "00000000",
    "password":   "hellohello"
  }'
```

Réponse attendue : `{ "status": "success", "user_id": <N> }`

### Vérifier le login

```bash
curl -s -X POST "http://127.0.0.1:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"imen.mallouli@malloulinova.com","password":"hellohello"}'
```

Réponse attendue : `{ "status": "success", "access_token": "eyJ..." }`

---

## 5. Configuration AutoPi Cloud

### 5.1 Activer le MQTT Returner

Aller sur [my.autopi.io](https://my.autopi.io) → sélectionner le device → **Advanced Settings** → **MQTT**.

| Champ | Valeur |
|---|---|
| Enabled | ✅ true |
| Host | `broker.emqx.io` |
| Port | `1883` |
| Username | *(laisser vide)* |
| Password | *(laisser vide)* |
| QoS | 1 |

Cliquer **Save** puis **Sync**.

> Le broker `broker.emqx.io` est un broker public EMQX, sans authentification requise.
> En production, remplacer par un broker privé sécurisé.

### 5.2 Configurer les loggers OBD

Pour chaque logger (RPM, SPEED, FUEL\_LEVEL, COOLANT\_TEMP, GET\_DTC) :

1. Aller dans **Loggers** → sélectionner le logger
2. Cliquer **Advanced**
3. Mettre **Returner = mqtt**
4. Cliquer **Update**

Puis cliquer **Sync** en haut de la page pour synchroniser le device.

> **Pourquoi `Active = ❌` ?**
> Le logger ne peut lire de données OBD que si le dongle est **branché dans le port OBD du véhicule**
> ET que le **contact est mis (allumage ON)**. Sans connexion OBD physique, les loggers restent inactifs.

### 5.3 Vérifier la connexion du device

Dans AutoPi Cloud, l'onglet **Device** doit afficher :

- Online : ✅
- Last seen : horodatage récent

---

## 6. Lancement du bridge MQTT (mqtt_gateway.py)

Le bridge est le fichier `backend/scripts/mqtt_gateway.py`.

### Commande complète (Git Bash)

```bash
cd "/c/auto diagnostic platform/backend"

"/c/auto diagnostic platform/.venv/Scripts/python.exe" \
  "./scripts/mqtt_gateway.py" \
  --mqtt-host broker.emqx.io \
  --mqtt-port 1883 \
  --vehicle-id 1 \
  --autopi-device-id c917fc1199ff \
  --base-url http://127.0.0.1:8000 \
  --email "imen.mallouli@malloulinova.com" \
  --password "hellohello" \
  --verbose
```

### Paramètres détaillés

| Paramètre | Description | Valeur exemple |
|---|---|---|
| `--mqtt-host` | Host du broker MQTT public | `broker.emqx.io` |
| `--mqtt-port` | Port du broker | `1883` |
| `--vehicle-id` | ID du véhicule en base (PostgreSQL) | `1` |
| `--autopi-device-id` | Fin de l'Unit ID AutoPi (6 derniers caractères) | `c917fc1199ff` |
| `--base-url` | URL du backend FastAPI | `http://127.0.0.1:8000` |
| `--email` | Email du compte backend | `imen.mallouli@malloulinova.com` |
| `--password` | Mot de passe du compte backend | `hellohello` |
| `--verbose` | Affiche les topics non reconnus | *(flag)* |
| `--token` | JWT pré-existant (si déjà obtenu) | `eyJ...` |
| `--qos` | Niveau QoS MQTT (0/1/2) | `1` *(défaut)* |

> **Note sur `--autopi-device-id` :**
> Correspond aux 12 derniers caractères de l'Unit ID AutoPi.
> Exemple : Unit ID `ccb71376-cd13-b201-170e-c917fc1199ff` → device ID `c917fc1199ff`

### Sortie attendue au démarrage

```
[API] Token obtained via /api/v1/auth/login
[CONFIG] Mode         : AutoPi
[CONFIG] vehicle_id   : 1
[CONFIG] device_id    : c917fc1199ff
[CONFIG] broker       : broker.emqx.io:1883
[CONFIG] backend      : http://127.0.0.1:8000
[MQTT] Connecting to broker.emqx.io:1883 ...
[MQTT] Connected (code=0)
[MQTT] Subscribed (AutoPi): obd/#
[MQTT] Subscribed (AutoPi): spm/bat
[MQTT] Subscribed (AutoPi): track/pos
[MQTT] Subscribed (AutoPi): acc/xyz
[MQTT] Subscribed (AutoPi): reactor
[MQTT] Subscribed (AutoPi): rpi/temp
[RUN] MQTT gateway started (Ctrl+C to stop)
```

### Sortie lors de la réception de données

```
[FORWARD] telemetry OK [battery_voltage] topic=spm/bat status=success
[FORWARD] event OK type=device_event topic=reactor status=success
[FORWARD] telemetry OK [rpm] topic=obd/rpm status=success
[FORWARD] dtc OK code=P0300 topic=obd/dtc status=success
```

---

## 7. Topics MQTT et format des payloads

### Topics souscrits (mode AutoPi natif)

| Topic MQTT | Données | Type AutoPi (`@t`) |
|---|---|---|
| `obd/#` | Tous PIDs OBD-II | `obd.rpm`, `obd.speed`, `obd.coolant_temp`… |
| `spm/bat` | Tension batterie | `spm.battery` ou `obd.bat` |
| `track/pos` | Position GPS | `track.pos` |
| `acc/xyz` | Accéléromètre | `acc.xyz` |
| `reactor` | Événements device | `event.*` |
| `rpi/temp` | Température Raspberry Pi | `rpi.temp` |

### Format du payload AutoPi

Tous les payloads publiés par AutoPi Cloud ont la structure :

```json
{
  "@t":  "<type>",
  "@ts": "2026-03-30T10:00:00Z",
  "<champ1>": <valeur1>,
  "<champ2>": <valeur2>
}
```

#### Exemples par topic

**`spm/bat`** — Tension batterie :
```json
{ "@t": "spm.battery", "@ts": "2026-03-30T10:00:00Z", "voltage": 12.4 }
```

**`obd/rpm`** — Régime moteur :
```json
{ "@t": "obd.rpm", "@ts": "2026-03-30T10:00:00Z", "value": 1850 }
```

**`obd/speed`** — Vitesse :
```json
{ "@t": "obd.speed", "@ts": "2026-03-30T10:00:00Z", "value": 65 }
```

**`obd/dtc`** — Code défaut :
```json
{ "@t": "obd.dtc", "@ts": "2026-03-30T10:00:00Z", "codes": ["P0300", "P0420"] }
```

**`track/pos`** — GPS :
```json
{ "@t": "track.pos", "@ts": "2026-03-30T10:00:00Z", "loc": {"lat": 36.81, "lon": 10.18}, "sog": 55 }
```

**`reactor`** — Événement device :
```json
{ "@t": "event.system", "@ts": "2026-03-30T10:00:00Z", "@tag": "system/minion/online" }
```

---

## 8. Correspondance OBD → champs télémétrie

Le bridge transforme les `@t` AutoPi en champs de la table télémétrie :

| Type AutoPi (`@t`) | Champ télémétrie backend | Description |
|---|---|---|
| `obd.rpm` | `rpm` | Régime moteur (tr/min) |
| `obd.speed` | `speed` | Vitesse (km/h) |
| `obd.fuel` / `obd.fuel_level` | `fuel_level` | Niveau carburant (%) |
| `obd.coolant` / `obd.coolant_temp` / `obd.engine_temp` | `engine_temp` | Température moteur (°C) |
| `obd.bat` / `obd.battery` / `spm.battery` | `battery_voltage` | Tension batterie (V) |

Les données non reconnues comme télémétrie sont stockées en tant qu'**événement IoT** dans `/api/v1/dtc/iot/logs` afin de ne perdre aucune donnée.

---

## 9. Endpoints API appelés par le bridge

### `POST /api/v1/auth/login`

Authentification au démarrage du bridge.

```json
{
  "email":    "imen.mallouli@malloulinova.com",
  "password": "hellohello"
}
```

Réponse : `{ "status": "success", "access_token": "eyJ..." }`

---

### `POST /api/v1/telemetry`

Ingestion des données de télémétrie (RPM, vitesse, température…).

```json
{
  "vehicle_id":       1,
  "ts":               "2026-03-30T10:00:00Z",
  "battery_voltage":  12.4
}
```

Réponse : `{ "status": "success" }`

---

### `POST /api/v1/dtc`

Ingestion d'un code défaut OBD-II.

```json
{
  "vehicle_id":       1,
  "code":             "P0300",
  "description":      "",
  "first_detected":   "2026-03-30T10:00:00Z",
  "last_occurrence":  "2026-03-30T10:00:00Z"
}
```

---

### `POST /api/v1/dtc/iot/logs`

Ingestion d'un événement IoT (événements device, GPS, accéléromètre, température RPi, PIDs inconnus).

```json
{
  "vehicle_id":  1,
  "device_id":   "c917fc1199ff",
  "event_type":  "device_event",
  "level":       "info",
  "message":     "system/minion/online",
  "metadata":    { "@t": "event.system", "@tag": "system/minion/online" },
  "event_at":    "2026-03-30T10:00:00Z"
}
```

---

## 10. Vérification des données ingérées

### Obtenir un token JWT

```bash
# Git Bash
TOKEN=$(curl -s -X POST "http://127.0.0.1:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"imen.mallouli@malloulinova.com","password":"hellohello"}' \
  | python -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

echo "Token: $TOKEN"
```

### Vérifier la télémétrie (vehicle_id=1)

```bash
curl -s "http://127.0.0.1:8000/api/v1/telemetry/1" \
  -H "Authorization: Bearer $TOKEN"
```

Réponse attendue (exemple avec `battery_voltage`) :
```json
{
  "status": "success",
  "vehicle_id": 1,
  "battery_voltage": [
    { "timestamp": "2026-03-30T09:00:00", "value": 17.154 },
    { "timestamp": "2026-03-30T10:00:00", "value": 17.154 }
  ]
}
```

### Vérifier les codes DTC

```bash
curl -s "http://127.0.0.1:8000/api/v1/dtc?vehicle_id=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Vérifier les événements IoT

```bash
curl -s "http://127.0.0.1:8000/api/v1/dtc/iot/logs?device_id=c917fc1199ff" \
  -H "Authorization: Bearer $TOKEN"
```

Réponse attendue :
```json
{
  "status": "success",
  "count": 2,
  "items": [
    {
      "device_id":   "c917fc1199ff",
      "vehicle_id":  1,
      "event_type":  "device_event",
      "level":       "info",
      "message":     "system/minion/online"
    }
  ]
}
```

### Documentation Swagger interactive

Ouvrir dans le navigateur : [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 11. Connexion OBD véhicule (étape finale)

> Cette étape nécessite le **hardware physique**. Toute la partie logicielle est déjà validée.

### Procédure

1. **Brancher** le dongle AutoPi dans le port OBD-II du véhicule
   - Le port OBD-II est généralement sous le tableau de bord, côté conducteur
2. **Mettre le contact ON** (ou démarrer le moteur)
3. **Attendre 2 à 5 minutes** que le dongle initialise et que les loggers démarrent
4. **Vérifier dans AutoPi Cloud** → Loggers → chaque logger doit afficher `Active = ✅`
5. **Vérifier que le bridge reçoit des données :**
   ```
   [FORWARD] telemetry OK [rpm] topic=obd/rpm status=success
   [FORWARD] telemetry OK [speed] topic=obd/speed status=success
   [FORWARD] telemetry OK [engine_temp] topic=obd/coolant_temp status=success
   ```
6. **Vérifier via l'API :**
   ```bash
   curl -s "http://127.0.0.1:8000/api/v1/telemetry/1" -H "Authorization: Bearer $TOKEN"
   ```

### Données OBD attendues après connexion véhicule

| Champ | Unité | Valeur typique |
|---|---|---|
| `rpm` | tr/min | 700–4000 |
| `speed` | km/h | 0–200 |
| `engine_temp` | °C | 80–105 |
| `fuel_level` | % | 0–100 |
| `battery_voltage` | V | 12–14.5 |

---

## 12. Dépannage — Erreurs rencontrées et solutions

### Erreur 1 : Docker engine non démarré

**Message :**
```
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

**Cause :** Docker Desktop n'est pas lancé.

**Solution :**
```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Start-Sleep -Seconds 30
cd "C:\auto diagnostic platform\backend"
docker compose up -d --build
```

---

### Erreur 2 : Login bridge échoue

**Message :**
```
RuntimeError: Login succeeded but access_token not found in response
```

**Cause :** Le compte utilisateur n'existe pas en base de données.

**Solution :** Créer le compte via `POST /api/v1/auth/register` (voir [section 4](#4-création-du-compte-utilisateur-backend)).

---

### Erreur 3 : JSON invalide via mosquitto_pub

**Message :**
```
[MQTT] Invalid JSON on reactor: Invalid \escape
```

**Cause :** Les guillemets et backslashes sont mal échappés dans le shell lors d'un `docker exec mosquitto_pub`.

**Solution :** Utiliser un script Python pour publier :
```python
import paho.mqtt.publish as publish, json

payload = json.dumps({
    "@t":   "event.system",
    "@ts":  "2026-03-30T10:00:00Z",
    "@tag": "system/minion/online"
})
publish.single("reactor", payload=payload, hostname="broker.emqx.io", port=1883, qos=1)
print("published")
```

---

### Erreur 4 : `jq` non installé sur Windows

**Symptôme :** `jq: command not found` quand on veut parser le JSON du login.

**Solution :** Utiliser Python à la place :
```bash
TOKEN=$(curl -s -X POST "http://127.0.0.1:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"imen.mallouli@malloulinova.com","password":"hellohello"}' \
  | python -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
```

---

### Erreur 5 : Bridge s'arrête (exit code 1)

**Cause possible 1 :** Backend non démarré ou inaccessible.

**Vérification :**
```bash
curl -s http://127.0.0.1:8000/health
# ou
docker compose ps
```

**Cause possible 2 :** Token JWT expiré (TTL = 60 minutes). Le bridge doit être relancé.

**Solution :** Relancer le bridge avec `--email` et `--password` (il obtient un nouveau token automatiquement).

---

### Vérification rapide de l'état de santé

```bash
# 1. Backend accessible ?
curl -s http://127.0.0.1:8000/docs | grep -c "swagger"

# 2. Login fonctionnel ?
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"imen.mallouli@malloulinova.com","password":"hellohello"}' | python -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('status')=='success' else 'FAIL')"

# 3. Broker MQTT public accessible ?
python -c "
import paho.mqtt.client as mqtt
c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
c.connect('broker.emqx.io', 1883, 5)
c.disconnect()
print('broker OK')
"
```

---

## 13. Résumé du pipeline validé

> **État au 30 mars 2026** — Toute la partie logicielle est confirmée opérationnelle.

| Étape | Statut | Détail |
|---|---|---|
| Docker containers (4) | ✅ | `adp-backend`, `adp-postgres`, `adp-mongo`, `adp-mqtt` |
| Compte utilisateur backend | ✅ | `imen.mallouli@malloulinova.com` / admin |
| Bridge connecté à `broker.emqx.io` | ✅ | Connecté, 6 topics souscrits |
| Ingestion télémétrie `battery_voltage` | ✅ | 2 entrées confirmées via `GET /api/v1/telemetry/1` |
| Ingestion événements IoT (`device_event`) | ✅ | `count=2` via `GET /api/v1/dtc/iot/logs?device_id=c917fc1199ff` |
| RPM / Speed / Engine temp / Fuel | ⏳ | En attente connexion OBD véhicule |
| Codes DTC réels | ⏳ | En attente connexion OBD véhicule |
| AutoPi Cloud → Loggers `Active=✅` | ⏳ | En attente branchement port OBD + contact ON |

### Ce qui fonctionne sans le véhicule

- `spm/bat` → `battery_voltage` ✅ (alimenté en externe, sans OBD)
- `reactor` → événements device ✅ (heartbeat, online/offline)
- `rpi/temp` → température Raspberry Pi ✅ (si activé dans le Reactor)
- `track/pos` → GPS ✅ (si le dongle a un fix GPS)

### Ce qui nécessite le port OBD + contact ON

- `obd/rpm`, `obd/speed`, `obd/coolant_temp`, `obd/fuel_level`
- `obd/dtc` → codes défauts
