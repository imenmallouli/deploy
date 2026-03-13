# auto-diagnostic-platform
Platform for remote and intelligent auto diagnostic
Location: C:\auto diagnostic platform\backend\.venv\Lib\site-packages



cd "c:\auto diagnostic platform\backend"
docker compose up -d --build
docker compose ps
Puis ouvre:

http://127.0.0.1:8000/docs

Si tu as l'erreur `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`, lance plutôt:

```powershell
cd "c:\auto diagnostic platform\backend"
powershell -ExecutionPolicy Bypass -File .\scripts\docker-up.ps1
```

Ce script démarre Docker Desktop automatiquement (si nécessaire), attend que le daemon soit prêt, puis lance `docker compose up -d --build`.

Si tu utilises Git Bash, tu peux lancer:

```bash
cd "/c/auto diagnostic platform/backend"
bash ./scripts/docker-up.sh
```








cd "C:\auto diagnostic platform\backend"
docker compose up -d --build
docker compose ps
cd "C:\auto diagnostic platform\frontend-web"
npm run dev

## OBD Gateway MVP

Pour lire un dongle ELM327 et envoyer les données vers `/api/v1/telemetry` et `/api/v1/dtc`, voir:

- `docs/obd_gateway_mvp.md`

## Guide Device / Dongle

Pour travailler la partie Device (dongle) étape par étape, voir:

- `docs/README_device_dongle.md`

## Guide MQTT / Broker / Dongle (FR)

Pour la partie MQTT (broker, topics, liaison données dongle vers backend) en détail:

- `docs/README_mqtt_dongle_fr.md`