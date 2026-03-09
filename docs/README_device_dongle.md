# README - Partie Device / Dongle (étape par étape)

Ce guide explique comment travailler la partie **Device (dongle OBD)** dans ce projet, de l'initialisation jusqu'à la vérification fonctionnelle.

## 1) Objectif métier

Un **device** représente le **dongle installé dans le véhicule**.

Son rôle:
- identifier le boîtier (`device_id`),
- associer le boîtier à un véhicule (`vehicle_id`, `vin`),
- remonter un état (`status`: `online` / `offline` / `warning`),
- servir de point d'entrée pour la télémétrie, les jobs, geofences, loggers, etc.

---

## 2) Prérequis

1. Lancer le backend:

```bash
cd "C:\auto diagnostic platform\backend"
docker compose up -d --build
docker compose ps
```

2. Ouvrir Swagger:

```text
http://127.0.0.1:8000/docs
```

3. Lancer le frontend:

```bash
cd "C:\auto diagnostic platform\frontend-web"
npm run dev
```

---

## 3) Modèle de données Device

Côté backend (`DeviceCreate`):
- `device_id` (obligatoire)
- `vehicle_id` (optionnel)
- `vin` (optionnel)
- `status` (optionnel, défaut: `offline`)

Exemple payload:

```json
{
  "device_id": "ccb71376",
  "vehicle_id": 1,
  "vin": "VF3XXXXXXXXXXXXXX",
  "status": "offline"
}
```

---

## 4) Workflow recommandé (pratique)

## Étape A — Authentification

- Utiliser `/api/v1/auth/login` (ou `/register`) dans Swagger.
- Copier le token et cliquer **Authorize**.

## Étape B — Créer un dongle

- Endpoint: `POST /api/v1/devices`
- Envoyer le payload JSON (exemple ci-dessus).

## Étape C — Vérifier la création

- Endpoint: `GET /api/v1/devices`
- Vérifier que `device_id` apparaît dans la liste.

## Étape D — Vérifier dans l'UI

- Aller sur **Devices > List**.
- Rechercher le `device_id` créé.
- Cliquer sur le nom du device pour ouvrir la page détail `/devices/:deviceId`.

## Étape E — Mettre à jour (si nécessaire)

- Endpoint: `PUT /api/v1/devices/{item_id}`
- Exemple:

```json
{
  "status": "online",
  "vehicle_id": 1
}
```

## Étape F — Supprimer (nettoyage test)

- Endpoint: `DELETE /api/v1/devices/{item_id}`

---

## 5) Comment répondre au jury (version courte)

- **C'est quoi un Device ?**
  - Le dongle OBD installé dans le véhicule.
- **Pourquoi on le crée ?**
  - Pour relier un boîtier physique à une identité logicielle (`device_id`) et à un véhicule.
- **Comment vous validez ?**
  - Création via API, lecture via `GET /devices`, puis vérification visuelle dans la page Devices.
- **Comment on change son état ?**
  - Via `PUT /devices/{item_id}` en modifiant `status`.

---

## 6) Erreurs fréquentes et solutions

- **401 Unauthorized**
  - Refaire login et réinjecter le token dans Swagger.
- **422 Validation Error**
  - Vérifier champs obligatoires (`device_id`) et types (`vehicle_id` numérique).
- **Device non visible dans UI**
  - Rafraîchir la page Devices / vérifier le filtre status / faire une recherche vide.
- **Conflit ID device**
  - Utiliser un `device_id` unique (ex: `ccb71376-01`).

---

## 7) Bonnes pratiques

- Utiliser une convention de nommage claire pour `device_id`.
- Lier chaque device à un véhicule réel de test.
- Garder `status` cohérent avec la connectivité réelle.
- Après chaque création, faire un `GET /devices` de contrôle.

---

## 8) Endpoints utiles (résumé)

- `POST /api/v1/devices` → créer
- `GET /api/v1/devices` → lister
- `GET /api/v1/devices/overview` → stats globales
- `PUT /api/v1/devices/{item_id}` → modifier
- `DELETE /api/v1/devices/{item_id}` → supprimer

---

Si besoin, prochaine étape: ajouter un **formulaire Create Device** directement dans l'UI (au lieu de passer par Swagger) pour une démo jury 100% front.