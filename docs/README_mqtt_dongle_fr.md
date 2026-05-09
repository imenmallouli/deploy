# Guide MQTT Dongle (FR) - Auto Diagnostic Platform

Ce guide explique la procedure complete pour connecter un dongle AutoPi a la plateforme via MQTT, verifier le flux temps reel, et diagnostiquer rapidement les pannes.

## 1) Architecture du flux

Dongle OBD -> AutoPi Cloud MQTT Returner -> broker.emqx.io -> mqtt_gateway.py -> API Backend -> MongoDB -> Frontend

Endpoints backend utilises:
- POST /api/v1/telemetry
- POST /api/v1/dtc
- POST /api/v1/geofences/vehicle-positions
- POST /api/v1/dtc/iot/logs

## 2) Important: lancer vs lire les logs

- Cette commande LANCE le service MQTT gateway:

```bash
cd "/c/auto diagnostic platform/backend"
docker compose up -d mqtt-gateway 
```

- Cette commande affiche seulement les logs (elle ne lance rien):

```bash
docker logs -f adp-mqtt-gateway
```

Si tu fais `docker compose up -d` (sans service), toute la stack se lance, y compris `mqtt-gateway`.

## 3) Prerequis

- Docker Desktop demarre
- Services backend UP
- Device AutoPi en ligne dans AutoPi Cloud
- Dossier projet:

```bash
cd "/c/auto diagnostic platform/backend"
```

## 4) Demarrage rapide

```bash
docker compose up -d
docker ps
```

Tu dois voir au minimum:
- adp-backend
- adp-mqtt-gateway
- adp-mongo
- adp-mqtt

## 5) Configuration AutoPi Cloud (obligatoire)

### 5.1 Returner MQTT

Device -> Settings -> Returner:
- Enabled: True
- Host: broker.emqx.io
- Port: 1883
- TLS: False
- Protocol: MQTTv311

### 5.2 GNSS (GPS)

Device -> Services -> gnss_manager -> worker poll_logger:
- Enabled: True
- Auto Start: True
- Interval: 5
- Returner: inclure mqtt
- Filter: pour test initial, retirer significant_position

Note: si `significant_position` est actif, la position peut ne pas partir tant que la voiture n'a pas assez bouge.

### 5.3 OBD Loggers

Device -> Loggers:
- RPM
- SPEED
- ENGINE_LOAD
- GET_DTC

`Enabled` doit etre vert.
`Active` peut rester rouge sur certains PID non supportes par la voiture, c'est normal.

## 6) Procedure de test final reel

1. Lancer la stack:

```bash
cd "/c/auto diagnostic platform/backend"
docker compose up -d
docker ps 
```

2. Ouvrir logs en direct:

```bash
docker logs -f adp-mqtt-gateway
```

3. Brancher le dongle dans la voiture.
4. Contact ON puis moteur ON.
5. Mettre la voiture en exterieur (GPS fix).
6. Attendre 30 a 120 secondes.

## 7) Resultat attendu dans les logs

Tu dois voir des lignes comme:

```text
[FORWARD] telemetry OK [...] topic=spm/bat
[FORWARD] telemetry OK [...] topic=.../track/pos
[GPS] position saved vehicle_id=11 lat=... lon=...
```

Si OBD remonte aussi:

```text
topic=.../obd/rpm
topic=.../obd/speed
topic=.../obd/engine_load
```

## 8) Verifications base de donnees

### 8.1 Derniere position GPS

```bash
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.vehicle_positions.find({vehicle_id:11},{_id:0,vehicle_id:1,latitude:1,longitude:1,speed:1,updated_at:1}).sort({\$natural:-1}).limit(1).toArray()"
```

### 8.2 Dernieres telemetries (vehicule 11)

```bash
docker exec adp-mongo mongosh mallouliauto --quiet --eval "db.telemetry_data.find({vehicleId:11},{_id:0,vehicleId:1,vehicle_id:1,timestamp:1,ts:1,speed:1,rpm:1,battery_voltage:1,battery_charge_level:1,nominal_voltage:1}).sort({\$natural:-1}).limit(20).toArray()"
```

## 9) Lecture UI attendue

### 9.1 Locations
- Le point dongle vert montre la derniere position connue.
- Si un nouveau `track/pos` arrive, la position est mise a jour.

### 9.2 Diagnostic
- Si flux recent: valeurs live.
- Si flux stale: les valeurs passent a 0 (comportement corrige).

## 10) Troubleshooting rapide

### Cas A: spm/bat arrive, mais pas track/pos
- Revoir gnss_manager (filter, returner, save/sync)
- Verifier GPS fix dehors
- Enlever `significant_position` pendant le test

### Cas B: spm/bat et track/pos arrivent, mais pas OBD
- Verifier moteur ON (pas juste contact)
- Verifier OBD loggers
- Certains PID peuvent etre non supportes

### Cas C: rien n'arrive
- Verifier device online dans AutoPi Cloud
- Restart device
- Refaire Save + Sync
- Verifier que `adp-mqtt-gateway` est UP via `docker ps`

## 11) Checklist demo (ultra-courte)

1. docker compose up -d
2. docker logs -f adp-mqtt-gateway
3. Dongle branche + moteur ON + dehors
4. Voir topic spm/bat + track/pos
5. Voir [GPS] position saved
6. Verifier Mongo vehicle_positions updated_at du jour
7. Verifier page Locations mise a jour

---

Si besoin, ajoutez vos captures d'ecran de logs et sorties Mongo a la fin de ce fichier pour tracer les tests finaux.
