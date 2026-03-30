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