# Conception Frontend Détaillée — Auto Diagnostic Platform

## 1) Objectif
Concevoir deux frontends alignés avec l’API backend actuelle:
- Web (dashboard opérationnel)
- Mobile (React Native)

Le design s’inspire des flux AutoPi (fleet/device/data).

Objectifs UX:
- Donner une vue opérationnelle rapide (dashboard + alertes + DTC + status véhicule).
- Réduire le nombre de clics pour atteindre le statut temps réel d’un véhicule.
- Respecter RBAC (admin, manager, driver).

---

## 2) Périmètre MVP

### Inclus MVP
- Authentification (login/register/logout)
- Dashboard opérationnel
- Véhicules (liste, détail, status)
- Télémétrie historique
- DTC (liste, création, historique, clear)
- Alertes (liste, création, ack)
- Flottes (liste)

### Hors MVP (phase 2)
- Carte GPS temps réel avancée
- Notifications push temps réel
- Paramétrage utilisateur avancé
- Reporting PDF/CSV
- White-labeling complet

---

## 3) Architecture Frontend (recommandée)

### 3.1 Frontend Web (admin/ops)
- Framework: React + TypeScript (Vite)
- Router: React Router
- State server: TanStack Query (React Query)
- State client: Zustand
- UI: Tailwind + composants maison
- Graphes: Recharts
- Auth storage: token en mémoire + fallback localStorage (MVP)

Structure recommandée (web):
- frontend-web/src/app (routing + providers)
- frontend-web/src/pages (écrans)
- frontend-web/src/features (auth, vehicles, telemetry, dtc, alerts, fleets)
- frontend-web/src/components (UI partagée)
- frontend-web/src/lib/api (client HTTP + interceptors)
- frontend-web/src/lib/auth (token, guard RBAC)

### 3.2 Frontend Mobile (driver/manager)
- Framework: React Native (Expo) + TypeScript
- Navigation: React Navigation (Stack + Bottom Tabs)
- State server: TanStack Query (React Query)
- State client: Zustand
- UI: React Native Paper
- Graphes: react-native-chart-kit (ou victory-native)
- Auth storage: expo-secure-store (pas localStorage)

Structure recommandée (mobile):
- mobile-app/src/app (providers + bootstrap)
- mobile-app/src/navigation (root stack + tabs)
- mobile-app/src/screens (écrans)
- mobile-app/src/features (auth, vehicles, telemetry, dtc, alerts, fleets)
- mobile-app/src/components (UI partagée)
- mobile-app/src/lib/api (axios + interceptors)
- mobile-app/src/lib/auth (token + guards RBAC)

### 3.3 Noyau partagé (optionnel mais conseillé)
- shared/types (DTO API, types métier)
- shared/constants (rôles, statuts, enums)
- shared/validation (schémas communs)

### 3.4 Compatibilité Node/Expo (Windows)
- Recommandé: Node.js 20 LTS
- Éviter Node 22 avec Expo pour limiter les erreurs Metro/AggregateError

---

## 4) Plan des pages (10 pages)

1. Login
2. Register
3. Dashboard
4. Vehicles List
5. Vehicle Details
6. Vehicle Status
7. Telemetry History
8. DTC
9. Alerts
10. Fleets

---

## 5) Détail page par page

## 5.1 Login
But: connecter un utilisateur existant.

Champs:
- email (required)
- password (required)

Actions:
- Se connecter
- Lien vers Register

Règles:
- Afficher message d’erreur backend si credentials invalides.
- Redirection vers Dashboard si succès.

API:
- POST /api/v1/auth/login

---

## 5.2 Register
But: créer un compte.

Champs:
- first_name (required)
- last_name (required)
- email (required)
- role (required; default driver)
- phone (required)
- password (required)

Actions:
- Créer compte
- Lien vers Login

API:
- POST /api/v1/auth/register

---

## 5.3 Dashboard
But: vue globale opérationnelle.

Widgets:
- KPI: nombre véhicules
- KPI: alertes pending
- KPI: DTC actifs
- KPI: dernière synchro (timestamp)
- Liste 5 dernières alertes
- Liste 5 véhicules à surveiller (status warning/critical)

Navigation rapide:
- Clic KPI alertes -> page Alerts
- Clic KPI DTC -> page DTC
- Clic véhicule -> Vehicle Status

APIs (batch):
- GET /api/v1/vehicles
- GET /api/v1/alerts?status=pending
- GET /api/v1/dtc (limité)

---

## 5.4 Vehicles List
But: consulter et filtrer les véhicules.

Composants:
- Table colonnes: id, plate, make/model, year, mileage, status, last_connection
- Search bar (VIN / plate / modèle)
- Filtre status
- Bouton Create Vehicle (admin/manager)

Actions:
- Voir détail
- Voir status

APIs:
- GET /api/v1/vehicles
- POST /api/v1/vehicles

---

## 5.5 Vehicle Details
But: fiche technique du véhicule.

Sections:
- Identité: VIN, plate, make/model/year
- Assignation: fleet_id, driver_id, dongle
- Meta: created_at, updated_at

Actions:
- Modifier véhicule (admin/manager)
- Supprimer (admin)
- Aller vers status

APIs:
- GET /api/v1/vehicles/{id}
- PUT /api/v1/vehicles/{id}
- DELETE /api/v1/vehicles/{id}

---

## 5.6 Vehicle Status
But: écran temps réel consolidé.

Blocs:
- Header status: healthy/warning/critical
- Last update
- Telemetry latest: speed, rpm, fuel_level, engine_temp, battery_voltage
- DTC actifs: compteur + top 3 codes
- Alertes actives: compteur pending
- (Phase 2) GPS map + adresse

API:
- GET /api/v1/vehicles/{id}/status

---

## 5.7 Telemetry History
But: visualiser historique métriques.

Filtres:
- vehicle_id (required)
- start (datetime)
- end (datetime)
- interval (1m, 5m, 1h, 1d)
- metrics[] (multi-select)

Graphes:
- Courbe par métrique
- Tooltip timestamp + value

API:
- GET /api/v1/telemetry/{vehicle_id}

---

## 5.8 DTC
But: diagnostic et suivi DTC.

Sections:
- Liste DTC (table)
- DTC par véhicule
- Historique par code/id
- Action clear (admin/manager)
- Form create DTC (test/ingest)

APIs:
- GET /api/v1/dtc
- GET /api/v1/dtc/{vehicle_id}
- GET /api/v1/dtc/{dtc_id}/history
- POST /api/v1/dtc
- POST /api/v1/dtc/clear

---

## 5.9 Alerts
But: traitement des alertes.

Fonctions:
- Liste filtrable (vehicle_id, type, severity, status)
- Create alert (admin/manager)
- Ack alert avec note

APIs:
- GET /api/v1/alerts
- GET /api/v1/alerts/{vehicle_id}
- POST /api/v1/alerts
- POST /api/v1/alerts/ack

---

## 5.10 Fleets
But: vision flotte.

Fonctions:
- Liste des flottes
- (Phase 2) détail flotte + véhicules associés

API:
- GET /api/v1/fleets

---

## 6) Navigation UX

Navigation principale (sidebar):
- Dashboard
- Vehicles
- Vehicle Status (contextuel)
- Telemetry
- DTC
- Alerts
- Fleets

Navigation contextuelle depuis Vehicle Details:
- Onglets: Status | Telemetry | DTC | Alerts

Header global:
- Recherche véhicule
- Profil utilisateur
- Logout

---

## 7) RBAC Frontend

Rôles backend: admin, manager, driver.

Permissions UI:
- admin: tout
- manager: create vehicle, create/ack alert, clear DTC, visibilité flotte gérée
- driver: lecture limitée (son véhicule, ses alertes/dtc/télémétrie)

Comportement:
- Les boutons non autorisés sont cachés.
- Les routes non autorisées redirigent vers page 403 (ou Dashboard).

---

## 8) Formulaires (détaillés)

## 8.1 Vehicle Form
- vin: string(17)
- license_plate: string
- make: string
- model: string
- year: number
- mileage: number >= 0
- status: pending/healthy/warning/critical
- dongle_id: string optionnel

Validation:
- champs required non vides
- year entre 1990 et année+1

## 8.2 Telemetry Filter Form
- vehicle_id: required
- start/end: ISO datetime
- interval: enum
- metrics: array

Validation:
- start < end

## 8.3 DTC Form
- vehicle_id: required
- code: required
- severity: info/warning/critical
- description: optionnel
- resolved: bool (default false)

## 8.4 Alert Form
- vehicle_id: required
- type: required
- severity: required
- title: required
- message: required

## 8.5 Ack Alert Form
- alert_id: required
- note: optionnel

---

## 9) Contrats API côté frontend

Headers:
- Authorization: Bearer <access_token>
- Content-Type: application/json

Gestion erreurs:
- 401: token invalide/expiré -> logout + redirect login
- 403: accès refusé -> toast + fallback route
- 422: erreurs de validation -> affichage champ par champ
- 500: erreur serveur -> message global + retry

---

## 10) États UI et feedback

- Loading skeleton sur tables/cartes
- Empty state explicite ("Aucune donnée")
- Error state avec bouton retry
- Toast succès (create/update/ack/clear)

---

## 11) Performance et cache

MVP:
- React Query cacheTime 5 min pour listes
- invalidation ciblée après mutation

Phase 2:
- Polling status véhicule toutes les 15-30s
- WebSocket/SSE pour alertes temps réel

---

## 12) Roadmap d’implémentation frontend

Sprint FE-1:
- Auth + Layout + Sidebar + Guards RBAC
- Dashboard
- Vehicles list + details

Sprint FE-2:
- Vehicle status
- Telemetry history
- DTC page
- Alerts page

Sprint FE-3:
- Fleets
- QA UX + responsive + optimisation

---

## 13) Critères d’acceptation (MVP)

- Login/Register fonctionnels
- Navigation sans blocage entre modules
- Vehicle status affiche telemetry + compte DTC + alertes
- Telemetry history filtrable par interval/date
- DTC clear disponible selon rôle
- Alerts ack disponible selon rôle
- Aucun crash sur erreurs backend standards

---

## 14) Notes d’alignement avec AutoPi

Inspirations retenues:
- Priorité donnée au triptyque Device/Fleet/Data
- Focus opérationnel: status en premier, détails ensuite
- Vision “fleet management + device management + diagnostics”

Adaptation projet:
- Backend local actuel orienté endpoints API v1
- Stack data effective: PostgreSQL + MongoDB
- Conception MVP pragmatique pour avancer vite
