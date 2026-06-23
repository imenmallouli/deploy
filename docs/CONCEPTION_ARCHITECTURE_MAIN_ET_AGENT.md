# 📐 CONCEPTION DÉTAILLÉE : Backend Main.py & Agent Mallouli

**Auteur**: Imen Mallouli  
**Date**: Juin 2026  
**Projet**: Auto Diagnostic Platform  
**Sujet**: Architecture complète et rôles du Backend et de l'Agent Dongle

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble générale](#1-vue-densemble-générale)
2. [Composant 1 : Backend `main.py` (FastAPI)](#2-composant-1--backend-mainpy-fastapi)
3. [Composant 2 : Agent Dongle `mallouli-agent`](#3-composant-2--agent-dongle-mallouli-agent)
4. [Architecture complète et flux de données](#4-architecture-complète-et-flux-de-données)
5. [Structure de fichiers et responsabilités](#5-structure-de-fichiers-et-responsabilités)
6. [Checklist de configuration avant implémentation](#6-checklist-de-configuration-avant-implémentation)
7. [Diagrammes UML](#7-diagrammes-uml)

---

## 1. VUE D'ENSEMBLE GÉNÉRALE

### 1.1 Contexte du projet

La plateforme **Auto Diagnostic Platform** est un système complet de diagnostic automobile en temps réel qui :

- **Collecte des données** depuis des dongles OBD-II (AutoPi) branchés sur les véhicules
- **Traite et valide** les données en provenance des dongles
- **Stocke** les données (télémétrie, codes d'erreur DTC, positions GPS)
- **Expose des API** pour l'application mobile et le tableau de bord web
- **Génère des alertes** intelligentes en temps réel

### 1.2 Les deux systèmes principaux

| Système | Localisation | Rôle | Technologie |
|---------|-------------|------|-------------|
| **Backend API** | Cloud / Serveur | Réceptionne les données, gère la logique métier, expose les APIs | FastAPI (Python) + PostgreSQL/MongoDB |
| **Agent Dongle** | Sur le dongle physique (Raspberry Pi AutoPi) | Collecte les données OBD, les envoie au backend | Python simple + HTTP client |

### 1.3 Communication client-serveur

```
Dongle (Raspberry Pi)
    ↓
Agent Mallouli (main.py local au dongle)
    ↓
HTTP/HTTPS vers backend
    ↓
FastAPI main.py (backend)
    ↓
Base de données (PostgreSQL/MongoDB)
    ↓
APIs REST utilisées par mobile app & web
```

---

## 2. COMPOSANT 1 : Backend `main.py` (FastAPI)

### 2.1 Qu'est-ce que c'est ?

`main.py` est le **point d'entrée principal** de l'API backend. C'est une application **FastAPI** qui :

- Démarre le serveur web Python
- Configure les middlewares (CORS, authentification)
- Enregistre tous les endpoints API
- Gère le cycle de vie de l'application (démarrage/arrêt)

### 2.2 Responsabilités principales

#### 2.2.1 Configuration de l'application FastAPI

```python
from fastapi import FastAPI

app = FastAPI(
    title="Auto Diagnostic Platform API",
    description="API pour le diagnostic automatique de véhicules",
    version="1.0.0",
)
```

#### 2.2.2 Gestion des origines (CORS)

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://app.example.com"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
```


## 3. COMPOSANT 2 : Agent Dongle `mallouli-agent`

### 3.1 Qu'est-ce que c'est ?

L'**Agent Mallouli** est un script Python exécuté **directement sur le dongle (Raspberry Pi AutoPi)**. Son rôle est de :

- ✅ Lire les données OBD depuis l'API locale AutoPi (port 9000)
- ✅ Formater les données selon le schéma du backend
- ✅ Envoyer les données au backend via HTTPS
- ✅ Gérer les retries et erreurs réseau
- ✅ Tourner en continu comme un service systemd

### 3.2 Flux de données complet

```
┌─────────────────────────────────────────────────────────────┐
│  VÉHICULE & DONGLE AUTOPI (Raspberry Pi)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  OBD-II Port ──┬──► AutoPi Service (démon AutoPi)           │
│  (CAN Bus)     │    ├─ Logger RPM                           │
│                │    ├─ Logger SPEED                         │
│                │    ├─ Logger FUEL_LEVEL                    │
│                └────► Local API (port 9000)                │
│                                                              │
│                       ↓                                      │
│                                                              │
│  Agent Mallouli (ce script)                                 │
│  ├─ Étape 1: Lire unit_id depuis /etc/salt/minion_id       │
│  ├─ Étape 2: Obtenir token Local API                        │
│  ├─ Étape 3: Exécuter commandes OBD via POST /dongle/<id>   │
│  │   ├─ obd.query RPM                                       │
│  │   ├─ obd.query SPEED                                     │
│  │   ├─ obd.query FUEL_LEVEL                                │
│  │   └─ ... (9+ autres champs)                              │
│  ├─ Étape 4: Formatter payload JSON                         │
│  └─ Étape 5: Envoyer POST vers backend                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI main.py)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /api/v1/telemetry                                     │
│  ├─ Valider payload                                         │
│  ├─ Vérifier authentification (JWT token)                   │
│  ├─ Sauvegarder en DB                                       │
│  ├─ Vérifier les alertes                                    │
│  └─ Retourner 200 OK                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│  BASES DE DONNÉES                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PostgreSQL: vehicles, users, fleets, alerts                │
│  MongoDB: raw payloads, DTC descriptions                    │
│                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Structure des fichiers Agent

```
dongle-agent/
├── connect_to_dongle.py              # Diagnostic/debug SSH
├── etc/
│   ├── mallouli/
│   │   └── agent.env                 # Configuration (variables d'env)
│   └── systemd/
│       └── system/
│           └── mallouli-agent.service # Unit systemd pour auto-démarrage
└── opt/
    └── mallouli/
        └── agent/
            └── main.py               # Script principal de l'agent
```

### 3.4 Fichier de configuration : `agent.env`

```bash
# /etc/mallouli/agent.env
# Ce fichier est chargé par systemd au démarrage du service

# 🔌 Configuration Backend MallouliAuto
MALLOULI_API_BASE_URL=https://api.mallouliauto.tn
MALLOULI_VEHICLE_ID=1
MALLOULI_DEVICE_ID=ccb71376cd13b201170ec917fc1199ff
MALLOULI_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 🎯 API Locale AutoPi (ne pas modifier)
AUTOPI_LOCAL_API=http://127.0.0.1:9000
AUTOPI_UNIT_ID_FILE=/etc/salt/minion_id

# ⚙️ Paramètres Agent
PUSH_INTERVAL_SEC=5           # Envoyer une telemetrie toutes les 5s
REQUEST_TIMEOUT_SEC=10        # Timeout des requêtes HTTP
MAX_RETRIES=3                 # Nombre de tentatives en cas d'erreur
RETRY_DELAY_SEC=2             # Délai entre retries
LOG_LEVEL=INFO                # DEBUG, INFO, WARNING, ERROR
```

**Pourquoi cette configuration ?**
- `PUSH_INTERVAL_SEC=5` : Balance entre latence et charge réseau (pas trop d'appels API)
- `MAX_RETRIES=3` : Tolère les coupures réseau temporaires
- `AUTOPI_LOCAL_API=http://127.0.0.1:9000` : API locale AutoPi sur le dongle lui-même
- Tous les paramètres sont externalisés pour faciliter l'évolution

### 3.5 Étapes d'exécution du script agent

#### Étape 1: Lire le `unit_id` du dongle

```python
def get_unit_id() -> str:
    """
    Lit l'identifiant unique du dongle depuis le fichier.
    
    Le unit_id est statique pour ce dongle et utilisé pour identifier
    les messages en provenance de ce dongle au backend.
    """
    try:
        with open("/etc/salt/minion_id", "r") as f:
            uid = f.read().strip()
            return uid  # Ex: "ccb71376cd13b201170ec917fc1199ff"
    except FileNotFoundError:
        # Fallback: appel API
        resp = requests.get("http://127.0.0.1:9000/", timeout=5)
        return resp.json().get("unit_id", "")
```

**Pourquoi ?**
- Le unit_id est l'identifiant stable du dongle
- Permet au backend d'associer les données à ce dongle
- Stocké dans un fichier de configuration AutoPi

#### Étape 2: Obtenir un token d'authentification Local API

```python
def get_local_api_token() -> str:
    """
    Obtient un JWT token pour accéder à l'API locale AutoPi.
    
    Token valable pour une requête ou une session.
    """
    resp = requests.post(
        "http://127.0.0.1:9000/auth/login/",
        timeout=5,
    )
    return resp.json().get("token", "")
```

**Pourquoi ?**
- L'API locale AutoPi est protégée par un token
- Renouvellement à chaque cycle garantit la fraîcheur
- Évite les timeouts de session

#### Étape 3: Exécuter les commandes OBD

```python
def execute_obd_command(unit_id: str, local_token: str, obd_command: str) -> float | None:
    """
    Exécute une commande OBD via la Local API AutoPi.
    
    Exemples:
    - obd.query RPM → 3000 (tours/minute)
    - obd.query SPEED → 85.5 (km/h)
    - obd.query FUEL_LEVEL → 75.0 (%)
    - obd.battery → 13.2 (volts)
    """
    url = f"http://127.0.0.1:9000/dongle/{unit_id}/execute/"
    headers = {
        "Authorization": f"Bearer {local_token}",
        "Content-Type": "application/json",
    }
    body = {
        "command": obd_command,
        "arg": [],
        "kwarg": {},
    }
    
    resp = requests.post(url, json=body, headers=headers, timeout=5)
    if resp.status_code == 200:
        data = resp.json()
        val = data.get("value")  # AutoPi retourne {"value": 3000.0}
        return float(val) if val is not None else None
    return None
```

**Pourquoi ?**
- Exécute les commandes une par une via HTTP/JSON
- Chaque commande est atomique et indépendante
- AutoPi retourne le résultat immédiatement via HTTP
- Pas d'accès direct au CAN bus

#### Étape 4: Formatter les données en payload JSON

```python
def read_obd_data(unit_id: str, local_token: str) -> dict:
    """
    Rassemble tous les champs OBD dans un dictionnaire.
    """
    obd_map = {
        "speed": "obd.query SPEED",
        "rpm": "obd.query RPM",
        "fuel_level": "obd.query FUEL_LEVEL",
        "engine_temp": "obd.query COOLANT_TEMP",
        "engine_load": "obd.query ENGINE_LOAD",
        "battery_voltage": "obd.battery",
        "intake_temp": "obd.query INTAKE_TEMP",
    }
    
    data = {}
    for field, cmd in obd_map.items():
        data[field] = execute_obd_command(unit_id, local_token, cmd)
    
    return data
    # Retourne:
    # {
    #   "speed": 85.5,
    #   "rpm": 3000,
    #   "fuel_level": 75.0,
    #   "engine_temp": 95.0,
    #   "engine_load": 45.2,
    #   "battery_voltage": 13.5,
    #   "intake_temp": 42.0,
    # }
```

#### Étape 5: Envoyer au backend

```python
def send_telemetry(obd_data: dict) -> bool:
    """
    Envoie les données OBD au backend MallouliAuto.
    Implémente les retries en cas d'erreur réseau.
    """
    payload = {
        "vehicle_id": VEHICLE_ID,           # Ex: 1
        "device_id": DEVICE_ID,             # Ex: "ccb71376cd13b201170ec917fc1199ff"
        "dongle_id": DEVICE_ID,             # Même chose
        "ts": datetime.now(timezone.utc).isoformat(),  # Ex: "2026-06-22T10:30:00+00:00"
        "speed": obd_data.get("speed"),
        "rpm": obd_data.get("rpm"),
        "fuel_level": obd_data.get("fuel_level"),
        # ... etc
    }
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }
    # Retries avec backoff exponentiel
    for attempt in range(1, MAX_RETRIES + 1):

        try:
            resp = requests.post(
                f"{MALLOULI_API_BASE_URL}/api/v1/telemetry",
                json=payload,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code in (200, 201):
                log.info("✅ Telemetrie envoyee OK")
                return True
        except requests.exceptions.ConnectionError:
            log.warning(f"❌ Tentative {attempt}/{MAX_RETRIES}: pas de reseau")
        except requests.exceptions.Timeout:
            log.warning(f"⏱️ Tentative {attempt}/{MAX_RETRIES}: timeout")
        
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)  # Backoff avant retry
    
    return False
```

**Pourquoi ?**
- Les retries tolèrent les déconnexions réseau temporaires
- Le backoff évite de surcharger le backend
- Les logs facilitent le dépannage

### 3.6 Boucle principale

```python
def main():
    """
    Boucle infinie exécutée toutes les PUSH_INTERVAL_SEC.
    """
    log.info("🚀 Agent Mallouli démarrage")
    
    # Lire unit_id une seule fois
    unit_id = get_unit_id()
    
    while True:
        try:
            # 1. Obtenir un token Local API frais
            local_token = get_local_api_token()
            
            # 2. Lire les données OBD
            obd_data = read_obd_data(unit_id, local_token)
            
            # 3. Envoyer au backend
            send_telemetry(obd_data)
            
        except Exception as exc:
            log.error(f"Erreur: {exc}")
        finally:
            time.sleep(PUSH_INTERVAL)  # Attendre avant le prochain cycle
```

### 3.7 Service systemd : auto-démarrage

```ini
# /etc/systemd/system/mallouli-agent.service

[Unit]
Description=MallouliAuto Dongle Agent
Documentation=https://mallouliauto.tn
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/opt/mallouli/agent

# Charger les variables d'env
EnvironmentFile=/etc/mallouli/agent.env

# Commande de démarrage
ExecStart=/usr/bin/python3 /opt/mallouli/agent/main.py

# Redémarrage automatique en cas de crash
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

# Logs séparés
StandardOutput=append:/var/log/mallouli/agent.log
StandardError=append:/var/log/mallouli/agent.err.log

[Install]
WantedBy=multi-user.target
```

**Pourquoi systemd ?**
- Démarrage automatique après reboot
- Redémarrage automatique en cas de crash
- Gestion centralisée des services Linux
- Logs séparés pour faciliter le dépannage

---

## 4. ARCHITECTURE COMPLÈTE ET FLUX DE DONNÉES

### 4.1 Diagramme C4 - Niveau 1 (Système)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  🚗 VÉHICULE + DONGLE AUTOPI (Raspberry Pi)                │
│  └─ Agent Mallouli (script Python)                          │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + JWT Token
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ☁️ BACKEND CLOUD (FastAPI main.py)                         │
│  ├─ Routers API (auth, vehicle, telemetry, alert, dtc...)  │
│  ├─ Services métier (TelemetryService, AlertService...)    │
│  ├─ Modèles ORM (Vehicle, Telemetry, Alert, DTC...)        │
│  └─ Authentification (JWT, OAuth2)                          │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ PostgreSQL       │ │ MongoDB          │ │ TimescaleDB      │
│ ├─ vehicles      │ │ ├─ dtc_catalog   │ │ └─ telemetry_ts  │
│ ├─ users         │ │ ├─ raw_payloads  │ │    (time-series) │
│ ├─ fleets        │ │ └─ configurations│ │                  │
│ └─ alerts        │ │                  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │                                      │
          └────────────────┬─────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  📱 APP MOBILE + WEB (React Native / Web)                   │
│  ├─ Dashboard fleet (carte, alertes, status)                │
│  ├─ Détails véhicule (historique, DTC)                      │
│  ├─ Graphiques telemetry (RPM, temp, speed)                │
│  └─ Notifications en temps réel (WebSocket)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Flux complet d'une données

```
Minute 0:
  └─ Agent Dongle: exécute obd.query RPM → 3000 rpm
  └─ Agent Dongle: exécute obd.query SPEED → 85.5 km/h
  └─ Agent Dongle: formate payload JSON
  └─ Agent Dongle: POST /api/v1/telemetry
                        {"vehicle_id": 1, "rpm": 3000, "speed": 85.5, ...}

Minute 0.1:
  └─ Backend main.py reçoit la requête
  └─ Valide le payload (Pydantic schema)
  └─ Vérifie le JWT token
  └─ Appelle TelemetryService.save_telemetry()
       ├─ Vérifier vehicle_id existe
       ├─ Dédupliquer si timestamp identique
       ├─ INSERT INTO telemetry (...)
       └─ Vérifier les alertes
            └─ SI engine_temp > 120 → CREATE alert "ENGINE_OVERHEAT"
  └─ Retourne 200 OK

Minute 0.2:
  └─ Mobile app fait GET /api/v1/telemetry?vehicle_id=1&limit=100
  └─ Backend retourne les 100 derniers enregistrements
  └─ App affiche un graphique temps réel

Minute 5.0:
  └─ Agent Dongle (PUSH_INTERVAL_SEC = 5) boucle à nouveau
  └─ Même processus...
```

---

## 5. STRUCTURE DE FICHIERS ET RESPONSABILITÉS

### 5.1 Structure complète du projet

```
auto-diagnostic-platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                          👈 POINT D'ENTRÉE FASTAPI
│   │   │
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py                  Router pour authentification
│   │   │       ├── vehicle.py               Router pour véhicules
│   │   │       ├── telemetry.py             Router pour télémétrie
│   │   │       ├── alert.py                 Router pour alertes
│   │   │       ├── dtc.py                   Router pour codes d'erreur
│   │   │       ├── fleet.py                 Router pour flottes
│   │   │       ├── maintenance.py           Router pour maintenance
│   │   │       ├── ai.py                    Router pour prédictions IA
│   │   │       ├── realtime.py              Router pour WebSocket
│   │   │       └── ops.py                   Router pour operations
│   │   │
│   │   ├── models/                          ORM SQLAlchemy
│   │   │   ├── __init__.py
│   │   │   ├── user.py                      Table users
│   │   │   ├── vehicle.py                   Table vehicles
│   │   │   ├── telemetry.py                 Table telemetry
│   │   │   ├── alert.py                     Table alerts
│   │   │   └── dtc.py                       Table dtc_codes
│   │   │
│   │   ├── schemas/                         Pydantic validation
│   │   │   ├── __init__.py
│   │   │   ├── telemetry.py                 TelemetryIngest schema
│   │   │   ├── alert.py                     AlertResponse schema
│   │   │   └── ...
│   │   │
│   │   ├── services/                        Logique métier
│   │   │   ├── __init__.py
│   │   │   ├── telemetry_service.py         TelemetryService
│   │   │   ├── alert_service.py             AlertService
│   │   │   └── ...
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py                  Connexion DB + session
│   │   │   ├── orm.py                       Configuration ORM
│   │   │   └── migrations.py                Alembic migrations
│   │   │
│   │   └── security/
│   │       ├── __init__.py
│   │       ├── jwt.py                       JWT creation/verification
│   │       ├── oauth2.py                    OAuth2 schemes
│   │       └── password.py                  Password hashing
│   │
│   ├── tests/
│   │   ├── test_api_endpoints.py            Tests API
│   │   ├── test_services.py                 Tests services
│   │   └── conftest.py                      Fixtures pytest
│   │
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── pytest.ini
│
├── dongle-agent/                             👈 AGENT DONGLE
│   ├── connect_to_dongle.py                 SSH diagnostic
│   ├── etc/
│   │   ├── mallouli/
│   │   │   └── agent.env                    Configuration Agent
│   │   └── systemd/
│   │       └── system/
│   │           └── mallouli-agent.service   Unit systemd
│   └── opt/
│       └── mallouli/
│           └── agent/
│               └── main.py                  👈 SCRIPT AGENT PRINCIPAL
│
├── docs/
│   ├── CONCEPTION_ARCHITECTURE_MAIN_ET_AGENT.md  👈 CE FICHIER
│   ├── design_auto_diagnostic_platform.md
│   ├── architecture_rapport.md
│   └── ...
│
├── frontend-web/                            App web React
├── mobile-app/                              App mobile React Native
└── README.md
```

### 5.2 Matrice de responsabilités (RACI)

| Tâche | Frontend | Backend | Agent | DB |
|-------|----------|---------|-------|-----|
| Afficher alertes | ✅ Display | ✅ Créer | ❌ | ✅ Store |
| Valider telemetry | ❌ | ✅ Validate | ✅ Format | ✅ Persist |
| Lire OBD | ❌ | ❌ | ✅ Query | ❌ |
| Générer JWT | ❌ | ✅ Create | ❌ | ✅ Store |
| Afficher graphiques | ✅ Render | ✅ Query | ❌ | ✅ Store |
| Décider retry | ❌ | ❌ | ✅ Logic | ❌ |

---

## 6. CHECKLIST DE CONFIGURATION AVANT IMPLÉMENTATION

### 6.1 Sur le dongle (Raspberry Pi AutoPi)

#### ✅ Préalables matériels
- [ ] Dongle AutoPi connecté au véhicule (OBD-II port)
- [ ] Dongle connecté au WiFi ou 4G
- [ ] Accès SSH possible (pi@192.168.1.147)

#### ✅ Configuration AgentEnv
- [ ] Fichier `/etc/mallouli/agent.env` créé
- [ ] `MALLOULI_API_BASE_URL` = URL backend (ex: https://api.mallouliauto.tn)
- [ ] `MALLOULI_VEHICLE_ID` = ID du véhicule en base backend
- [ ] `MALLOULI_DEVICE_ID` = ID unique du dongle (lisible dans AutoPi Cloud)
- [ ] `MALLOULI_API_TOKEN` = JWT token valide généré depuis `/api/v1/auth/login`
- [ ] `PUSH_INTERVAL_SEC` = 5 (ajuster selon performance désirée)

#### ✅ Installation du script Agent
- [ ] Répertoire `/opt/mallouli/agent/` créé
- [ ] Script `/opt/mallouli/agent/main.py` copié
- [ ] Permissions: `chmod +x /opt/mallouli/agent/main.py`
- [ ] `requirements.txt` installé: `pip3 install -r requirements.txt`
  ```
  requests==2.31.0
  ```

#### ✅ Configuration systemd
- [ ] Fichier `/etc/systemd/system/mallouli-agent.service` copié
- [ ] Permissions: `sudo chmod 644 /etc/systemd/system/mallouli-agent.service`
- [ ] Recharger: `sudo systemctl daemon-reload`
- [ ] Activer: `sudo systemctl enable mallouli-agent`
- [ ] Tester démarrage: `sudo systemctl start mallouli-agent`
- [ ] Vérifier status: `sudo systemctl status mallouli-agent`
- [ ] Consulter logs: `journalctl -u mallouli-agent -f`

#### ✅ Test de connectivité
- [ ] `ping 8.8.8.8` (internet disponible ?)
- [ ] `curl http://127.0.0.1:9000/` (Local API AutoPi répond ?)
- [ ] `curl -X POST http://127.0.0.1:9000/auth/login/` (Token LocalAPI possible ?)

### 6.2 Sur le backend (serveur)

#### ✅ Variables d'environnement
- [ ] `DATABASE_URL` = `postgresql://user:pass@host:5432/db`
- [ ] `MONGODB_URL` = `mongodb://user:pass@host:27017/db`
- [ ] `SECRET_KEY` = clé secrète pour JWT (généré)
- [ ] `CORS_ORIGINS` = URLs autorisées (ex: http://localhost:3000)
- [ ] `LOG_LEVEL` = INFO

#### ✅ Bases de données
- [ ] PostgreSQL running et accessible
- [ ] MongoDB running et accessible
- [ ] Tables créées via migrations Alembic
- [ ] Indice sur `telemetry.ts` créé (performance requêtes temps-série)

#### ✅ Configuration FastAPI
- [ ] main.py modifié si nécessaire
- [ ] Tous les routers importés et incluris
- [ ] CORS configuré correctement
- [ ] Lifespan configuré (connexions DB)

#### ✅ Authentification
- [ ] JWT secret configuré
- [ ] Endpoint `/api/v1/auth/login` fonctionnel
- [ ] Token test généré (pour l'agent)
- [ ] Token test sauvegardé dans `agent.env` du dongle

#### ✅ Déploiement backend
- [ ] Code déployé sur serveur
- [ ] Docker image builte et pushée
- [ ] Container démarré et logs ok
- [ ] Health check: `curl https://api.mallouliauto.tn/` → 200 OK

### 6.3 Test de communication end-to-end

#### ✅ Test 1: Agent → Backend (telemetry)
```bash
# Sur le dongle
python3 /opt/mallouli/agent/main.py
# Devrait voir dans les logs:
#   ✅ Connexion autorisée
#   ✅ OBD data lu
#   ✅ Telemetry envoyée au backend

# Sur le backend, vérifier:
curl -H "Authorization: Bearer <JWT_TOKEN>" \
     https://api.mallouliauto.tn/api/v1/telemetry?vehicle_id=1&limit=1
# Devrait retourner les derniers enregistrements
```

#### ✅ Test 2: Agent crash & recovery
```bash
# Arrêter l'agent intentionnellement
kill -9 $(pgrep -f "mallouli-agent")

# Vérifier que systemd le redémarre automatiquement
sudo systemctl status mallouli-agent
# Devrait voir: "active (running)" après ~5 sec (RestartSec=5)
```

#### ✅ Test 3: Alertes générées
```bash
# Injecter une donnée qui déclenche une alerte
# Ex: engine_temp = 130 (seuil critique)

# Vérifier que l'alerte est créée
curl -H "Authorization: Bearer <JWT_TOKEN>" \
     https://api.mallouliauto.tn/api/v1/alerts?vehicle_id=1
# Devrait voir: {"type": "ENGINE_OVERHEAT", "severity": "CRITICAL", ...}
```

---

## 7. DIAGRAMMES UML

### 7.1 Diagramme d'état (Agent Dongle)

```
                     ┌─────────────────┐
                     │    INIT PHASE   │
                     └────────┬────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │ Lire unit_id         │
                    │ Charger config env   │
                    │ Lancer logging       │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
         OK    │                              │ Error
         ──────▼──────                  ──────▼──────
      ┌──────────────────┐           ┌──────────────┐
      │  MAIN LOOP       │           │    EXIT      │
      │  (infini)        │           │   Code 1     │
      └────────┬─────────┘           └──────────────┘
               │
     ┌─────────▼──────────┐
     │ Obtenir token API  │
     └──────────┬─────────┘
                │
     ┌──────────▼──────────┐
     │  Lire OBD data      │
     │  (9 commandes)      │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────────────┐
     │ Formatter payload JSON       │
     └──────────┬──────────────────┘
                │
     ┌──────────▼──────────────────┐
     │ Send telemetry (+ retries)  │
     └──────────┬──────────────────┘
                │
        ┌───────▼────────┐
        │ SLEEP           │
        │ PUSH_INTERVAL   │
        └───────┬────────┘
                │
                └─────── (boucle)
```

---

## RÉSUMÉ ET POINTS CLÉS

### ✅ Main.py (Backend FastAPI)

| Aspect | Description |
|--------|-------------|
| **Rôle** | API REST centralisée pour recevoir, stocker et servir les données |
| **Langage** | Python 3.8+ |
| **Framework** | FastAPI (async, performant, doc auto) |
| **Authentification** | JWT token + OAuth2 |
| **Routers** | 10+ domaines (auth, vehicle, telemetry, alert, dtc, etc.) |
| **Validation** | Pydantic schemas (auto-validation) |
| **Stockage** | PostgreSQL + MongoDB + TimescaleDB |
| **Architecture** | Routers → Services → ORM → Database |
| **Déploiement** | Docker container sur cloud (Azure/AWS) |
| **Port** | 8000 (développement) ou 443 (production HTTPS) |

### ✅ Mallouli-Agent (Dongle Script)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Collecte OBD, envoie au backend (client léger) |
| **Localisation** | Sur Raspberry Pi AutoPi (dongle) |
| **Langage** | Python 3 simple (pas async) |
| **API Local** | Utilise port 9000 AutoPi Local API |
| **Authentification** | JWT token backend + Local API token |
| **Cycle** | Toutes les 5-10 secondes (configurable) |
| **Retries** | Jusqu'à 3 tentatives en cas d'erreur réseau |
| **Démarrage** | systemd service (auto-restart on crash) |
| **Configuration** | `/etc/mallouli/agent.env` |
| **Logs** | `/var/log/mallouli/agent.log` |

### ✅ Communication Agent ↔ Backend

```
┌──────────────────────────┐
│  Agent Dongle            │
│  POST /api/v1/telemetry  │
│  {                       │
│    vehicle_id: 1,        │
│    device_id: "xxx",     │
│    speed: 85.5,          │
│    rpm: 3000,            │
│    engine_temp: 95.0,    │
│    ...                   │
│  }                       │
└──────────┬───────────────┘
           │ HTTPS + JWT
           ▼
┌──────────────────────────┐
│  Backend FastAPI         │
│  @router.post("/telemetry") │
│  1. Valider payload      │
│  2. Vérifier JWT         │
│  3. Appeler service      │
│  4. Sauvegarder en DB    │
│  5. Générer alertes      │
│  6. Retourner 200 OK     │
└──────────────────────────┘
```

### ✅ Prochaines étapes

1. **Configurer backend** : main.py, routers, services, modèles
2. **Configurer DB** : PostgreSQL tables, MongoDB collections, migrations
3. **Authentification** : JWT secrets, login endpoint, token generation
4. **Configurer agent** : agent.env, requirements, systemd service
5. **Tester end-to-end** : Agent → Backend → DB → API
6. **Monitoring** : Logs, alertes, métriques (Prometheus/Grafana)
7. **Mobile app** : Intégration APIs, WebSocket temps réel, visualisations

---
