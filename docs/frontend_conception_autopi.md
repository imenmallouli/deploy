# Conception Frontend Corrigée — MALLOULIAUTO Cloud

## 1) Objectif
Définir une conception frontend alignée avec l’implémentation réelle du projet `frontend-web`.

Objectifs UX:
- Vue opérationnelle immédiate (fleet + devices + diagnostics + alertes).
- Actions directes via toolbar (Search, Filters, Columns, Refresh, Create).
- Intégration native avec l’API backend v1 (`/api/v1/...`) et Swagger/ReDoc.

---

## 2) État actuel du scope (implémenté)

### Inclus aujourd’hui
- Auth: Login, Register, Logout
- Get Started
- Fleet Management: Overview, Vehicles (list/details), Geofences, Groups, Locations, Diagnostics, Alerts
- Device Management: Overview, Devices, OBD Library, Vehicle Status, Telemetry
- Fleets (liste + opérations de base)

### Partiellement implémenté
- RBAC granulaire UI (rôle stocké mais règles UI incomplètes)


### Hors scope actuel
- Frontend mobile React Native (non présent dans ce workspace)


---

## 3) Stack technique réelle

### 3.1 Frontend Web
- React 18 + TypeScript + Vite
- React Router (routing protégé)
- TanStack Query (server state)
- Axios (client API + interceptors auth)
- Zustand installé (usage limité/optionnel)
- UI CSS maison (`styles.css`) — pas de Tailwind actif

### 3.2 Auth/session
- Token stocké dans `localStorage`
- Guard de route par session (`RequireAuth`)
- Interceptor Axios:
	- injecte `Authorization: Bearer <token>`
	- sur 401/403: clear session + redirect `/login`

---

## 4) Architecture frontend réelle

Structure:
- `frontend-web/src/app` (layout, router, guard)
- `frontend-web/src/components` (Sidebar, TopBar)
- `frontend-web/src/pages` (pages métier)
- `frontend-web/src/lib/api` (client + endpoints + types)
- `frontend-web/src/lib/auth` (session)
- `frontend-web/src/styles.css` (design system local)

Patterns UI utilisés:
- Table + toolbar standardisée
- Panneaux togglables: Filters / Columns / Actions
- Feedback visible: loading, erreurs, succès, empty state

---

## 5) Plan des routes (corrigé)

Public:
- `/login`
- `/register`

Protégé:
- `/get-started`
- `/overview`
- `/vehicles/list`
- `/vehicles/geofences`
- `/vehicles/groups`
- `/vehicles/:vehicleId`
- `/locations`
- `/diagnostics` (alias métier de DTC)
- `/vehicle-status`
- `/vehicle-status/:vehicleId`
- `/devices/overview`
- `/devices/list`
- `/devices/obd-library`
- `/telemetry`
- `/dtc` (route additionnelle)
- `/alerts`
- `/fleets`

Redirections actives:
- `/` -> `/get-started`
- `/vehicles` -> `/vehicles/list`
- `/devices` -> `/devices/list`
- `/obd-library` -> `/devices/obd-library`

---

## 6) Pages et comportement attendu

### 6.1 Get Started
- Tuiles `Documentation`, `API Reference`, `Support` reliées aux ressources projet
- Section d’introduction + raccourcis opérationnels

### 6.2 Fleet Management
- `Overview`: KPIs, blocs fleet/alerts, liens de démarrage
- `Vehicles`: listing + création + édition/suppression via détails
- `Geofences`: map + recherche + filtres + colonnes + création + check position
- `Groups`: recherche + création
- `Locations`: recherche/filtres/colonnes + création
- `Diagnostics`/`DTC`: recherche, filtres date, clear/history, feedback
- `Alerts`: stats, filtres, colonnes, actions, ack unitaire/multi-sélection

### 6.3 Device Management
- `Devices Overview`: métriques globales devices
- `Devices`: recherche, colonnes, refresh, création (`device_id`, `vehicle_id`, `status`, `vin`)
- `OBD Library`: table OBD, filtres/colonnes, import JSON/CSV
- `Vehicle Status`: synthèse statut véhicule
- `Telemetry`: ping, création télémétrie, historique, stream WebSocket

---

## 7) Contrats API utilisés côté frontend

Auth:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`

Fleet/Vehicle:
- `GET/POST /api/v1/vehicles`
- `GET/PUT/DELETE /api/v1/vehicles/{id}`
- `GET /api/v1/vehicles/{id}/status`
- `GET/POST/PUT/DELETE /api/v1/fleets...`

Diagnostics/Alerts/Telemetry:
- `GET/POST /api/v1/dtc`
- `GET /api/v1/dtc/{vehicle_id}`
- `GET /api/v1/dtc/{dtc_id}/history`
- `POST /api/v1/dtc/clear`
- `GET/POST /api/v1/alerts`
- `POST /api/v1/alerts/ack`
- `GET/POST /api/v1/telemetry`
- `GET /api/v1/telemetry/{vehicle_id}`

Ops (pages AutoPi-like):
- `GET/POST /api/v1/geofences`
- `POST /api/v1/geofences/check`
- `GET/POST /api/v1/groups`
- `GET/POST /api/v1/locations`
- `GET/POST /api/v1/devices`
- `GET /api/v1/devices/overview`

---

## 8) RBAC (corrigé)

### Réel aujourd’hui
- Authentification appliquée globalement
- Rôle stocké en session, mais contrôle fin des écrans/actions encore partiel

### Cible recommandée
- `admin`: accès complet
- `manager`: création/modification opérationnelle sans administration sensible
- `driver`: lecture limitée (véhicules/alertes/dtc autorisés)

Actions à implémenter:
- Guard par rôle sur routes sensibles
- Masquage conditionnel des boutons `Create`, `Delete`, `Clear`, `Ack bulk`

---

## 9) États UI / qualité

Standards déjà utilisés:
- `Loading` pendant requêtes
- `No data to display` si liste vide
- Messages de succès/erreur pour actions utilisateur

À uniformiser:
- Même wording d’erreur/succès sur toutes les pages
- Retry explicite là où les mutations sont critiques

---



## 11) Roadmap réaliste (prochaine itération)

Sprint A — Consolidation:
- Finaliser RBAC UI par rôle
- Uniformiser feedback UX sur toutes les pages
- Ajouter tests UI ciblés sur flux critiques

Sprint B — Data & temps réel:
- Standardiser polling/refresh modules fleet/device
- Étendre le temps réel (WebSocket) aux alertes/états critiques

Sprint C — Produit:
- Page Support interne (formulaire ticket)
- Documentation interne frontend (guide usage écrans)
- Préparer base mobile si besoin business validé

---

## 12) Critères d’acceptation (version corrigée)

- Toutes les routes listées en section 5 sont navigables sans erreur.
- Les pages toolbar (Alerts, DTC, Devices, Geofences, Locations, OBD Library) ont des boutons fonctionnels.
- `Documentation`, `API Reference`, `Support` sur Get Started sont reliés à des ressources projet.
- Le frontend reste aligné avec les endpoints disponibles dans `src/lib/api/endpoints.ts`.
- Aucun crash sur erreurs API standards (401/403/422/500).

---

## 13) Note de design

Le style visuel reste inspiré d’un flux type AutoPi (fleet/device/data), mais l’application est découplée d’AutoPi et reliée à l’écosystème MALLOULIAUTO (backend, docs, support) pour rester cohérente produit.
