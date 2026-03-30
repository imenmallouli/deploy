# OBD Gateway MVP (ELM327 -> API)

Ce script lit les données du dongle OBD (ELM327) et les envoie vers:
- `POST /api/v1/telemetry` (toutes les 1-2s)
- `POST /api/v1/dtc` (toutes les 10-30s)

Fichier: `backend/scripts/obd_gateway.py`

## 1) Installer dépendances

Dans ton environnement Python backend:

```powershell
pip install requests obd
```

## 2) Lancer le backend

Exemple:

```powershell
cd "c:\auto diagnostic platform\backend"
docker compose up -d --build
```

ou local uvicorn selon ta config.

## 3) Exécuter en mode réel dongle ELM327

```powershell
cd "c:\auto diagnostic platform\backend"
.\.venv\Scripts\python.exe .\scripts\obd_gateway.py \
  --base-url http://127.0.0.1:8000 \
  --vehicle-id 1 \
  --email ton_email@exemple.com \
  --password ton_mot_de_passe \
  --port COM5 \
  --telemetry-interval 2 \
  --dtc-interval 20
```

> Remplace `COM5` par ton port série ELM327.

## 4) Exécuter en mode simulation (sans dongle)

```powershell
cd "c:\auto diagnostic platform\backend"
.\.venv\Scripts\python.exe .\scripts\obd_gateway.py \
  --base-url http://127.0.0.1:8000 \
  --vehicle-id 1 \
  --email ton_email@exemple.com \
  --password ton_mot_de_passe \
  --simulate
```

## 5) PIDs utilisés

- `010C` RPM
- `010D` Vitesse
- `0105` Température moteur (coolant)
- `0142` Tension module/batterie
- `012F` Niveau carburant
- `03` DTC (Mode 03)

## 6) Vérification

- Dashboard page Telemetry: tu dois voir de nouveaux points.
- Endpoint `GET /api/v1/telemetry/{vehicle_id}`: historique présent.
- Endpoint `GET /api/v1/dtc/{vehicle_id}`: DTC visibles si codes actifs.
