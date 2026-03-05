# Fonctions ajoutées — Backend OPS

Ce fichier résume **exactement** les fonctions ajoutées dans le backend OPS.

## 1) Fichier router OPS
Fichier: `backend/app/api/v1/ops.py`

### Contexte auth
- `get_current_context(credentials)`
  - Vérifie le Bearer token
  - Extrait `user_id` + `role`
  - Retourne le contexte utilisateur

### Endpoints Geofences
- `list_geofences(q, context)` -> `GET /api/v1/geofences`
- `create_geofence(payload, context)` -> `POST /api/v1/geofences`
- `update_geofence(item_id, payload, context)` -> `PUT /api/v1/geofences/{item_id}`
- `delete_geofence(item_id, context)` -> `DELETE /api/v1/geofences/{item_id}`
- `check_geofences(payload, context)` -> `POST /api/v1/geofences/check`

### Endpoints Groups
- `list_groups(q, context)` -> `GET /api/v1/groups`
- `create_group(payload, context)` -> `POST /api/v1/groups`
- `update_group(item_id, payload, context)` -> `PUT /api/v1/groups/{item_id}`
- `delete_group(item_id, context)` -> `DELETE /api/v1/groups/{item_id}`

### Endpoints Locations
- `list_locations(q, context)` -> `GET /api/v1/locations`
- `create_location(payload, context)` -> `POST /api/v1/locations`
- `update_location(item_id, payload, context)` -> `PUT /api/v1/locations/{item_id}`
- `delete_location(item_id, context)` -> `DELETE /api/v1/locations/{item_id}`

### Endpoints Devices
- `list_devices(q, context)` -> `GET /api/v1/devices`
- `devices_overview(context)` -> `GET /api/v1/devices/overview`
- `create_device(payload, context)` -> `POST /api/v1/devices`
- `update_device(item_id, payload, context)` -> `PUT /api/v1/devices/{item_id}`
- `delete_device(item_id, context)` -> `DELETE /api/v1/devices/{item_id}`

---

## 2) Fichier service OPS
Fichier: `backend/app/services/ops_service.py`

### Fonctions CRUD génériques
- `_serialize(doc)`
  - Convertit `_id` Mongo en `id`
- `list_items(collection, q=None)`
  - Liste les éléments d’une collection
  - Supporte la recherche `q`
- `create_item(collection, payload)`
  - Création avec `created_at` / `updated_at`
- `update_item(collection, item_id, payload)`
  - Mise à jour partielle + `updated_at`
- `delete_item(collection, item_id)`
  - Suppression par `ObjectId`

### Fonctions métier ajoutées
- `get_devices_overview()`
  - Retourne statistiques devices: `total`, `online`, `offline`, `warning`

- `_distance_m(lat1, lng1, lat2, lng2)`
  - Calcul distance Haversine (mètres)

- `check_geofences(latitude, longitude, vehicle_id=None)`
  - Vérifie l’état inside/outside pour chaque geofence active
  - Gère les transitions `enter` / `exit`
  - Met à jour `geofence_vehicle_state`
  - Loggue les événements dans `geofence_events`

### Détail important ajouté dans la recherche
Dans `list_items`:
- Pour `devices`, recherche élargie sur:
  - `device_id`
  - `vin`
  - `status`
  - `vehicle_id` (si `q` numérique)
- Pour `locations`, recherche sur `name` + `type`
- Pour `geofences`, recherche sur `name` + `description`

---

## 3) Schémas OPS ajoutés
Fichier: `backend/app/schemas/ops.py`

### Geofences
- `GeofenceCreate`
- `GeofenceUpdate`
- `GeofenceCheckRequest`

### Groups
- `GroupCreate`
- `GroupUpdate`

### Locations
- `LocationCreate`
- `LocationUpdate`

### Devices
- `DeviceCreate`
- `DeviceUpdate`

---

## 4) Collections Mongo concernées
- `geofences`
- `groups`
- `locations`
- `devices`
- `geofence_vehicle_state`
- `geofence_events`

---

## 5) Résumé court
Les ajouts OPS couvrent:
- Un module API complet pour Geofences/Groups/Locations/Devices
- Un service CRUD générique + logique métier geofence/devices
- Une recherche backend améliorée (notamment pour devices)
- Des schémas Pydantic dédiés pour valider les payloads
