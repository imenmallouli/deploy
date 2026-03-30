# Robot Framework — Backend Smoke Tests

Suite de tests fonctionnels e2e pour le backend FastAPI Auto Diagnostic Platform.

---

## Prérequis

- Python ≥ 3.10
- Backend démarré sur `http://127.0.0.1:8000` (Docker ou local)
- Dépendances installées :

```bash
pip install -r tests/robot/requirements.txt
```

---

## Lancer les tests

Depuis le dossier `backend/` :

```bash
# Tous les tests — rapports sauvegardés dans tests/robot/reports/
python -m robot -d tests/robot/reports tests/robot/suites

# Un seul test
python -m robot -t "Register Login And Me Flow" -d tests/robot/reports tests/robot/suites

# Avec une URL différente (staging, CI, etc.)
python -m robot -v BASE_URL:http://staging.example.com -d tests/robot/reports tests/robot/suites
```

---

## Tests disponibles

### `backend_smoke.robot`

| # | Test | Endpoint | Vérification |
|---|---|---|---|
| 1 | Root Endpoint Returns Service Info | `GET /` | `status: ok`, `version: 1.0.0` |
| 2 | Create Tables Endpoint Is Reachable | `POST /api/v1/create-tables` | Code 200, champ `status` présent |
| 3 | Register Login And Me Flow | `POST /register` → `POST /login` → `GET /me` | Email retourné = email envoyé |

---

## Visualiser les rapports

Après exécution, trois fichiers sont générés dans `tests/robot/reports/` :

| Fichier | Description |
|---|---|
| `report.html` | Synthèse PASS/FAIL par test — **ouvrir en premier** |
| `log.html` | Détail de chaque étape : keywords, requêtes HTTP, réponses |
| `output.xml` | Export XML pour CI/CD (Jenkins, GitHub Actions) |

Ouvrir depuis Git Bash :

```bash
explorer tests/robot/reports/report.html
```

---

## Structure du dossier

```
tests/robot/
├── requirements.txt
├── resources/
│   ├── variables.robot    # BASE_URL, DEFAULT_PASSWORD, DEFAULT_PHONE
│   └── keywords.robot     # Create API Session, Login User, Register User, Get Me...
└── suites/
    └── backend_smoke.robot
```

---

## Dépendances (`requirements.txt`)

```
robotframework==7.1.1
robotframework-requests==0.9.7
```
