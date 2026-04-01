# Conception Frontend (As-Built) — MALLOULIAUTO Cloud

Auteur: Imen Mallouli  
Mise à jour: 31/03/2026  
But: documenter le frontend tel qu’il est réellement implémenté dans `frontend-web`.

---

## 1) Objectif



1. l’architecture frontend réelle,
2. les routes réellement actives,
3. les fonctionnalités effectivement codées page par page,
4. les points partiels/non branchés.

---

## 2) Stack frontend réellement utilisée

- React 18
- TypeScript
- Vite
- React Router (`createBrowserRouter`)
- TanStack React Query (`QueryClientProvider`)
- Axios (client API + interceptors auth)
- CSS custom (`src/styles.css`)

Dépendance installée mais non utilisée explicitement dans le code actuel:
- `zustand`

---

## 3) Architecture technique réelle

Structure principale:

- `src/app/`
  - `router.tsx` (routing)
  - `RequireAuth.tsx` (guard)
  - `AppLayout.tsx` (shell global)
- `src/components/`
  - `Sidebar.tsx`
  - `TopBar.tsx`
- `src/pages/` (pages métier)
- `src/lib/api/`
  - `client.ts` (axios + interceptors)
  - `endpoints.ts` (fonctions API)
  - `types.ts` (types TS)
- `src/lib/auth/session.ts` (stockage session)

---

## 4) Authentification & session

Implémentation réelle:

- Token stocké dans `localStorage` (`access_token`)
- Données session stockées: `role`, `email`, `user_id`
- `RequireAuth` protège toutes les routes privées
- Interceptor request Axios: ajoute `Authorization: Bearer <token>`
- Interceptor response Axios: sur `401/403` → clear session + redirection `/login`

Routes publiques:
- `/login`
- `/register`

Routes protégées:
- toutes les autres routes sous layout

---

## 5) Plan de routes réellement actives (`router.tsx`)

### Public
- `/login`
- `/register`

### Privé
- `/` → redirection vers `/get-started`
- `/get-started`
- `/overview`
- `/vehicles` → redirection vers `/vehicles/list`
- `/vehicles/list`
- `/vehicles/geofences`
- `/vehicles/groups`
- `/vehicles/:vehicleId`
- `/locations`
- `/diagnostics`
- `/vehicle-status`
- `/vehicle-status/:vehicleId`
- `/devices/overview`
- `/devices/list`
- `/devices/:deviceId`
- `/telemetry`
- `/dtc`
- `/alerts`
- `/fleets`
- `/devices` → redirection vers `/devices/list`


---

## 6) Navigation UI réelle

### Sidebar
Sections visibles:

- Get started
- Fleet Management:
  - Overview
  - Vehicles (List, Geofences, Groups)
  - Locations
  - Diagnostics
  - Alerts
- Device Management:
  - Overview
  - Devices
  - Vehicle Status
  - Telemetry

### TopBar
- Barre de recherche visuelle
- Badge rôle statique affiché: `manager`
- Bouton logout fonctionnel (`clearSession()` + navigate `/login`)

---

## 7) Implémentation page par page (réelle)

## 7.1 `GetStartedPage`

Implémenté:
- Chargement KPI rapides via API (`vehicles`, `alerts`, `dtc`)
- Liens externes:
  - Documentation → `/redoc`
  - API Reference → `/docs`
- Sections visuelles marketing/information

Non connecté:
- Boutons “Get expert guidance” et “Check our prices” (UI only)

## 7.2 `DashboardPage` (Overview)

Implémenté:
- Panneau "Getting Started" avec 3 étapes (liens Guide rapide vers vehicles, locations, geofences)
- Bloc "Fleet Overview" avec 4 stat-cards:
  - "Driving now" (count vehicles avec status='active')
  - "Driven today" (count vehicles avec status='active' ou 'warning')
  - "Driven last 30 days" (calcul simplifié: total - pending alerts)
  - "Not driven last 30 days" (total - driven last 30 days)
- Bloc "Open Alerts" (6 dernières alerts avec vehicle_id, title, severity)
- Bloc "Fleet Tracking" (static OpenStreetMap embed, non-interactif)
- Toutes les données chargées via `listVehicles`, `listAlerts`, `listDtc`

Partiel:
- Bouton "Show all vehicles" sans action réelle (UI only)

## 7.3 `VehiclesPage`

Implémenté:
- `GET /api/v1/vehicles` (liste)
- `POST /api/v1/vehicles` (création)
- `DELETE /api/v1/vehicles/{id}`
- Navigation vers détail véhicule + statut

## 7.4 `VehicleDetailsPage`

Implémenté:
- `GET /api/v1/vehicles/{id}`
- `PUT /api/v1/vehicles/{id}`
- `DELETE /api/v1/vehicles/{id}`
- Formulaire update multi-champs (VIN, plaque, make/model, year, mileage, fleet/driver, dongle, autopi ids)

## 7.5 `VehicleStatusPage`

Implémenté:
- `GET /api/v1/vehicles/{id}/status` via formulaire
- Affichage JSON du statut consolidé

## 7.6 `FleetsPage`

Implémenté:
- `GET /api/v1/fleets`
- `POST /api/v1/fleets`
- `PUT /api/v1/fleets/{id}`
- `DELETE /api/v1/fleets/{id}`
- `GET /api/v1/fleets/{id}`
- `GET /api/v1/fleets/{id}/vehicles`
- `POST /api/v1/fleets/{id}/vehicles` (assign vehicle)

## 7.7 `GeofencesPage`

Implémenté:
- `GET /api/v1/geofences`
- `POST /api/v1/geofences`
- `POST /api/v1/geofences/check`
- Toolbar (search, filters, columns)
- Iframe map OpenStreetMap

Partiel:
- Colonne Actions affiche `-` (pas de update/delete UI)

## 7.8 `GroupsPage`

Implémenté:
- `GET /api/v1/groups`
- `POST /api/v1/groups`
- Recherche + création

Partiel:
- Pas de update/delete UI

## 7.9 `LocationsPage`

Implémenté:
- `GET /api/v1/locations`
- `POST /api/v1/locations`
- Search / Filters / Columns / Refresh
- “Use my location” via `navigator.geolocation`
- Map OpenStreetMap

Partiel:
- Les champs notes/contact/address/on_enter/on_exit sont gérés côté état local UI (pas persistés via endpoint backend actuel)
- Pas de update/delete UI

## 7.10 `DevicesPage`

Implémenté:
- `GET /api/v1/devices`
- Search / Filters / Columns / Refresh
- Export CSV local
- Navigation vers `/devices/:deviceId`

Partiel:
- Pas de création/modification/suppression device depuis cette page

## 7.11 `DeviceOverviewPage`

Implémenté:
- `GET /api/v1/devices/overview`
- KPIs devices + DTC count

## 7.12 `DeviceDetailsPage`

Implémenté:
- Charge la donnée via `listDevices(deviceId)` et sélectionne device courant
- UI riche multi-onglets (Overview, Dashboard, Jobs, Services, Events, CAN Analyzer, Loggers, etc.)

Partiel:
- Une grande partie est démo/statique UI (placeholders), non branchée à des endpoints dédiés

## 7.13 `DtcPage` (Diagnostics)

Note: les routes `/diagnostics` et `/dtc` pointent toutes les deux vers le même composant `DtcPage`.

Implémenté:

**Endpoints utilisés:**
- `GET /api/v1/dtc` → chargement initial de la liste (limit 100)
- `GET /api/v1/dtc/{vehicle_id}` → filtre par véhicule (mutation manuelle)
- `GET /api/v1/dtc/{dtc_id}/history` → chargement historique d'un DTC spécifique
- `POST /api/v1/dtc` → création manuelle d'un DTC (vehicle_id, code, severity, description)
- `POST /api/v1/dtc/clear` → effacement d'un DTC (vehicle_id + dtc_code)
- `GET /api/v1/dtc/ping` → mutation disponible

**Tableau principal:**
- Colonnes: Code, Description, Vehicle, First occurrence, Last occurrence, Count, State (active/resolved), Actions
- Recherche textuelle sur `code` + `description`
- Filtre par date/heure (`datetime-local` input) sur `last_occurrence` ou `first_detected`
- Parsing format dates multiples (ISO + `DD/Mon/YYYY HH:MM`)

**Actions par ligne:**
- Bouton **History** → appelle `getDtcHistory(id)` + affiche résultat JSON dans un bloc `<pre>`
- Bouton **Clear** → appelle `clearDtc({ vehicle_id, dtc_code })` + feedback message succès/erreur
- Messages feedback distincts: `actionMessage` (succès) et `actionError` (erreur)

---

## 7.14 `AlertsPage`

Implémenté:
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/ack`
- Stats, filtres, colonnes, sélection multiple, ack bulk

## 7.15 `TelemetryPage`

Implémenté:
- `GET /api/v1/telemetry/{vehicle_id}` (historique)
- WebSocket temps réel: `/api/v1/realtime/ws/vehicles/{vehicle_id}`
- Connexion/déconnexion live + affichage événements JSON

Non implémenté sur cette page:
- `POST /api/v1/telemetry`
- `GET /api/v1/telemetry/ping`



## 8) Contrats API réellement utilisés (`src/lib/api/endpoints.ts`)

## 8.1 Auth
- `login(payload)` → `POST /api/v1/auth/login`
- `register(payload)` → `POST /api/v1/auth/register`

## 8.2 Vehicles
- `listVehicles`
- `createVehicle`
- `getVehicle`
- `updateVehicle`
- `deleteVehicle`
- `getVehicleStatus`



## 8.4 Alerts
- `listAlerts`
- `listAlertsByVehicle`
- `createAlert`
- `ackAlert`

## 8.5 DTC
- `listDtc`
- `pingDtc`
- `listDtcByVehicle`
- `getDtcHistory`
- `createDtc`
- `clearDtc`
- `createObdRawPayload`
- `listObdRawPayloads`
- `createIotLog`
- `listIotLogs`

## 8.6 Telemetry
- `getTelemetryHistory`
- `pingTelemetry`
- `createTelemetry`

## 8.7 Ops
- `listGeofences`
- `createGeofence`
- `checkGeofences`
- `listGroups`
- `createGroup`
- `listLocations`
- `createLocation`
- `listDevices`
- `createDevice`
- `getDevicesOverview`

### Important
Les wrappers frontend manquants dans `endpoints.ts` (backend existe, UI partielle):
- `PUT/DELETE /api/v1/geofences/{item_id}`
- `PUT/DELETE /api/v1/groups/{item_id}`
- `PUT/DELETE /api/v1/locations/{item_id}`
- `PUT/DELETE /api/v1/devices/{item_id}`

---

## 9) RBAC frontend (état réel)

Actuel:
- Auth globale fonctionnelle (route guard)
- Rôle stocké en session

Partiel:
- Pas de guard d’autorisation fine par rôle au niveau composants/pages/actions

---

## 10) Qualité UX/UI (état réel)

Présent:
- états loading/empty sur plusieurs pages
- messages succès/erreur sur mutations critiques
- toolbar homogène sur pages data

À améliorer:
- homogénéiser tous les messages erreurs/succès
- réduire les blocs UI statiques dans `DeviceDetailsPage`


---

## 11) Écarts conception vs implémentation (à mentionner dans rapport)

1. OBD Library existe mais n’est pas routée
2. OPS update/delete backend disponibles mais UI/frontend wrappers incomplets
3. RBAC UI fin non appliqué (auth uniquement)
4. Plusieurs boutons “marketing/placeholder” non connectés à des actions backend

---

## 12) Conclusion

Le frontend actuel est opérationnel pour le MVP web:

- authentification,
- navigation protégée,
- gestion flotte/véhicules,
- diagnostics/alertes,
- télémétrie historique + temps réel,
- vue devices et opérations terrain de base.


