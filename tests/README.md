# Backend Test Suite — Auto Diagnostic Platform

Ce dossier contient deux niveaux de tests automatisés pour le backend FastAPI.

---

## Sommaire

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Pytest — Tests API endpoint par endpoint](#pytest--tests-api-endpoint-par-endpoint)
4. [Robot Framework — Tests fonctionnels e2e](#robot-framework--tests-fonctionnels-e2e)
5. [Lancer tous les tests d'un coup](#lancer-tous-les-tests-dun-coup)
6. [Visualiser les rapports](#visualiser-les-rapports)

---

## Vue d'ensemble

| Framework | Fichier(s) | Ce qui est testé | Nb de tests |
|---|---|---|---|
| **pytest** | `tests/test_api_endpoints_smoke.py` | Tous les endpoints OpenAPI (aucun 500) | 57 |
| **Robot Framework** | `tests/robot/suites/backend_smoke.robot` | Flux fonctionnels métier (auth, register, me) | 3 |

---

## Prérequis

### 1. Backend démarré sur `http://127.0.0.1:8000`

**Option A — Docker (recommandé)**
```bash
cd "c:/auto diagnostic platform/backend"
bash ./scripts/docker-up.sh
```

**Option B — local**
```bash
cd "c:/auto diagnostic platform/backend"
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Dépendances de test installées
```bash
cd "c:/auto diagnostic platform/backend"
pip install -r tests/robot/requirements.txt
pip install pytest requests
```

---

## Pytest — Tests API endpoint par endpoint

### Ce qui est testé

Le fichier `test_api_endpoints_smoke.py` interroge automatiquement `/openapi.json`
et appelle **chaque route déclarée dans l'API** avec un token admin valide.

| Module | Routes couvertes |
|---|---|
| Database | `POST /create-tables` · `GET /list-tables` · `POST /sync-schema` |
| Auth | `POST /register` · `POST /login` · `GET /user/{id}` · `GET /me` |
| Fleets | `GET/POST/PUT/DELETE /fleets` · `GET/POST /{id}/vehicles` |
| Vehicles | `GET/POST/PUT/DELETE /vehicles` · `GET /{id}/status` |
| Alerts | `GET/POST /alerts` · `GET /{vehicle_id}` · `POST /ack` |
| DTC | `GET/POST /dtc` · `clear` · `obd/raw` · `iot/logs` · `ping` |
| Telemetry | `ping` · `POST /telemetry` · `GET /{vehicle_id}` |
| Realtime | `GET /realtime/info` |
| Ops | geofences · groups · locations · devices · overview |
| Root | `GET /` |

**Critère de succès :** chaque endpoint doit retourner un code HTTP dans  
`{200, 201, 202, 204, 400, 401, 403, 404, 405, 409, 422}` — jamais `500`.

### Lancer les tests

```bash
cd "c:/auto diagnostic platform/backend"

# Résultat court (ligne par ligne avec message final)
python -m pytest tests/test_api_endpoints_smoke.py -v --tb=short

# Résultat ultra-court
python -m pytest tests/test_api_endpoints_smoke.py -q

# Un seul endpoint spécifique
python -m pytest tests/test_api_endpoints_smoke.py -v -k "GET /api/v1/auth/me"
```

### Générer un rapport HTML pytest

```bash
pip install pytest-html

python -m pytest tests/test_api_endpoints_smoke.py \
    --html=tests/pytest-report.html \
    --self-contained-html \
    -v
```

Ouvrir `tests/pytest-report.html` dans un navigateur.

---

## Robot Framework — Tests fonctionnels e2e

### Ce qui est testé

| Test | Description |
|---|---|
| `Root Endpoint Returns Service Info` | Vérifie que `GET /` retourne `status: ok` et `version: 1.0.0` |
| `Create Tables Endpoint Is Reachable` | Vérifie que `POST /api/v1/create-tables` répond 200 avec `status` |
| `Register Login And Me Flow` | Crée un utilisateur admin → login → `GET /me` et compare l'email retourné |

### Structure des fichiers

```
tests/robot/
├── requirements.txt          # robotframework + robotframework-requests
├── resources/
│   ├── variables.robot       # BASE_URL, mot de passe, téléphone par défaut
│   └── keywords.robot        # Keywords réutilisables (login, register, etc.)
└── suites/
    └── backend_smoke.robot   # Suite principale
```

### Lancer les tests

```bash
cd "c:/auto diagnostic platform/backend"

# Lancement standard
python -m robot -d tests/robot/reports tests/robot/suites

# Avec URL différente (ex: staging)
python -m robot \
    -v BASE_URL:http://staging.example.com \
    -d tests/robot/reports \
    tests/robot/suites

# Un seul test
python -m robot \
    -t "Register Login And Me Flow" \
    -d tests/robot/reports \
    tests/robot/suites
```

### Visualiser les rapports Robot

Après exécution, trois fichiers sont générés dans `tests/robot/reports/` :

| Fichier | Contenu |
|---|---|
| `report.html` | Vue synthétique PASS/FAIL par test — **ouvrir en premier** |
| `log.html` | Détail de chaque keyword exécuté, avec les requêtes HTTP |
| `output.xml` | Export machine-readable (CI/CD) |

```bash
# Ouvrir le rapport dans le navigateur par défaut (Windows)
start tests/robot/reports/report.html

# Ou (Git Bash)
explorer tests/robot/reports/report.html
```

---

## Lancer tous les tests d'un coup

```bash
cd "c:/auto diagnostic platform/backend"

python -m pytest tests/test_api_endpoints_smoke.py -v --tb=short && \
python -m robot -d tests/robot/reports tests/robot/suites
```

Résultat attendu :

```
============================================================
  ✅  57 fonctions testées — TOUT FONCTIONNE AVEC SUCCÈS
============================================================
57 passed in 1.3s

...
3 tests, 3 passed, 0 failed
```

python -m pytest -q tests/test_api_endpoints_smoke.py