# Conception API et Backend - MALLOULIAUTO
**Plateforme de Diagnostic Automobile IoT**

**Author**: Imen Mallouli  
**Date**: Février 10, 2026  
**Sprint**: Sprint 3 (S5-S6) - API et Authentification  
**Phase**: Conception et Méthodologie de Travail

---

## Table des Matières

1. [Vue d'ensemble de l'API](#1-vue-densemble-de-lapi)
2. [Architecture Backend](#2-architecture-backend)
3. [Méthodologie de Travail](#3-méthodologie-de-travail)
4. [Structure du Projet](#4-structure-du-projet)
5. [Conception des Endpoints API](#5-conception-des-endpoints-api)
6. [Authentification et Sécurité](#6-authentification-et-sécurité)
7. [Contrôle d'Accès RBAC](#7-contrôle-daccès-rbac)
8. [Modèles de Données](#8-modèles-de-données)
9. [Gestion des Erreurs](#9-gestion-des-erreurs)
10. [Documentation et Tests](#10-documentation-et-tests)
11. [Plan d'Implémentation par Étapes](#11-plan-dimplémentation-par-étapes)

---

## 1. Vue d'ensemble de l'API

### 1.1 Objectifs de l'API

L'API REST constitue le cœur du système **MALLOULIAUTO**. Elle permet:

- ✅ **Communication sécurisée** entre les dongles OBD, le backend, et l'application
- ✅ **Gestion complète des véhicules** (CRUD, statut en temps réel, historique)
- ✅ **Accès aux données diagnostiques** (codes DTC, alertes, télémétrie)
- ✅ **Authentification robuste** avec JWT et contrôle d'accès RBAC
- ✅ **Scalabilité** pour supporter 100 à 10,000+ véhicules
- ✅ **Documentation automatique** avec OpenAPI/Swagger

### 1.2 Technologies Sélectionnées

| Technologie | Version | Utilisation |
|-------------|---------|-------------|
| **Python** | 3.11+ | Langage principal |
| **FastAPI** | 0.110+ | Framework API REST moderne et performant |
| **Pydantic** | 2.6+ | Validation de données et schémas |
| **SQLAlchemy** | 2.0+ | ORM pour PostgreSQL |
| **Motor** | 3.4+ | Driver async MongoDB |
| **PyJWT** | 2.8+ | Génération et validation des tokens JWT |
| **Passlib** | 1.7+ | Hachage sécurisé des mots de passe (bcrypt) |
| **Redis** | 7.2+ | Cache et gestion des sessions |
| **Uvicorn** | 0.27+ | Serveur ASGI haute performance |
| **Alembic** | 1.13+ | Migration de base de données |

### 1.3 Architecture API REST

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
│  React Native App · Dongles OBD · Admin Dashboard          │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTPS/TLS 1.3
┌─────────────────────────────────────────────────────────────┐
│                  API GATEWAY (FastAPI)                       │
│  ├─ Rate Limiting (100 req/min)                            │
│  ├─ JWT Validation                                         │
│  ├─ CORS Configuration                                      │
│  └─ Request Logging                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   ROUTING LAYER                              │
│  /api/v1/auth     → Authentication Service                  │
│  /api/v1/vehicles → Vehicle Management Service              │
│  /api/v1/dtc      → Diagnostic Service                      │
│  /api/v1/alerts   → Alert Management Service                │
│  /api/v1/telemetry → Telemetry Service                      │
│  /api/v1/users    → User Management Service                 │
│  /api/v1/fleets   → Fleet Management Service                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
│  ├─ Controllers (Request Handlers)                         │
│  ├─ Services (Business Logic)                              │
│  ├─ Validators (Data Validation)                           │
│  └─ Utils (Helper Functions)                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                          │
│  ├─ PostgreSQL (Véhicules, Utilisateurs, Flottes)         │
│  ├─ MongoDB (Codes DTC, Payloads bruts)                    │
│  ├─ TimescaleDB (Télémétrie historique)                    │
│  └─ Redis (Cache, Sessions, Pub/Sub)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Backend

### 2.1 Pattern Architecture: Layered Architecture

Le backend suit une **architecture en couches** (layered architecture) pour séparer les responsabilités:

```
┌──────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (API Routes)                             │
│  Endpoints FastAPI, validation des requêtes, sérialisation  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER (Services)                                │
│  Logique métier, orchestration, règles de gestion           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER (Models)                                       │
│  Entités métier, schémas Pydantic, DTOs                     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER (Repositories)                         │
│  Accès aux bases de données, cache, services externes       │
└──────────────────────────────────────────────────────────────┘
```


---

## 3. Méthodologie de Travail

### 3.1 Approche de Développement

#### Phase 1: Conception et Planification
- [ ] Lire et analyser les exigences du projet
- [ ] Définir les modèles de données (schémas Pydantic)
- [ ] Concevoir l'architecture de l'API (routes, services, repositories)
- [ ] Écrire les spécifications OpenAPI (Swagger)
- [ ] Créer les diagrammes de séquence pour les flux critiques

#### Phase 2: Configuration de l'Environnement
- [ ] Initialiser le projet FastAPI avec structure modulaire
- [ ] Installer les dépendances (requirements.txt)
- [ ] Configurer les connexions aux bases de données
- [ ] Mettre en place le système de logs

#### Phase 3: Développement par Modules
- [ ] **Jour 1-2**: Module d'authentification (JWT, login, register, refresh)
- [ ] **Jour 3**: Module de gestion des utilisateurs (CRUD, roles)
- [ ] **Jour 4**: Module de gestion des véhicules (CRUD, status)
- [ ] **Jour 5**: Module DTC et diagnostics
- [ ] **Jour 6**: Module alerts et télémétrie
- [ ] **Jour 7**: Module flottes

#### Phase 4: Tests et Validation
- [ ] Tests unitaires (pytest) pour chaque service
- [ ] Tests d'intégration pour les endpoints
- [ ] Tests de charge avec Locust (100-1000 req/s)
- [ ] Validation de la documentation Swagger

#### Phase 5: Sécurité et Optimisation
- [ ] Implémentation RBAC complet
- [ ] Rate limiting et throttling
- [ ] Audit de sécurité (OWASP)
- [ ] Optimisation des requêtes SQL (indexes, N+1)
- [ ] Configuration du cache Redis

### 3.2 Ordre de Développement des Endpoints

**Priorité HAUTE**:
1. `POST /api/v1/auth/register` - Inscription utilisateur
2. `POST /api/v1/auth/login` - Connexion (génération JWT)
3. `POST /api/v1/auth/refresh` - Rafraîchissement du token
4. `GET /api/v1/users/me` - Profil utilisateur connecté
5. `GET /api/v1/vehicles` - Liste des véhicules
6. `POST /api/v1/vehicles` - Création d'un véhicule
7. `GET /api/v1/vehicles/{id}` - Détails d'un véhicule

**Priorité MOYENNE**:
8. `GET /api/v1/dtc` - Liste des codes DTC actifs
9. `GET /api/v1/dtc/{vehicle_id}` - DTC d'un véhicule spécifique
10. `GET /api/v1/alerts` - Alertes actives
11. `POST /api/v1/alerts/ack` - Acquitter une alerte
12. `GET /api/v1/telemetry/{vehicle_id}` - Données télémétrie
13. `GET /api/v1/fleets` - Liste des flottes

### 3.3 Workflow de Développement par Endpoint

Pour chaque endpoint, suivre ce processus:

```
1. Définir le schéma Pydantic (Request + Response)
   ↓
2. Créer le modèle SQLAlchemy/Motor (database)
   ↓
3. Implémenter le Repository (data access)
   ↓
4. Créer le Service (business logic)
   ↓
5. Développer le Controller (API route)
   ↓
6. Écrire les tests unitaires (pytest)
   ↓
7. Tester manuellement avec Swagger UI
   ↓
8. Documenter l'endpoint (docstring + OpenAPI)
```

### 3.4 Outils de Développement

| Outil | Utilisation |
|-------|-------------|
| **VS Code** | IDE principal avec extensions Python |
| **Postman/Thunder Client** | Tests manuels des endpoints |
| **Swagger UI** | Documentation interactive auto-générée |
| **PostgreSQL pgAdmin** | Gestion de la base de données |
| **MongoDB Compass** | Visualisation des collections MongoDB |
| **Redis Insight** | Monitoring du cache Redis |
| **pytest** | Tests automatisés |
| **Black** | Formatage automatique du code Python |
| **Pylint/Flake8** | Linting et qualité du code |

---

## 4. Structure du Projet

### 4.1 Arborescence Complète

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # Point d'entrée FastAPI
│   ├── config.py                   # Configuration (env, settings)
│   ├── dependencies.py             # Dépendances réutilisables (DB, auth)
│   │
│   ├── api/                        # PRESENTATION LAYER
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py         # Routes d'authentification
│   │   │   │   ├── vehicles.py     # Routes véhicules
│   │   │   │   ├── dtc.py          # Routes diagnostics DTC
│   │   │   │   ├── alerts.py       # Routes alertes
│   │   │   │   ├── telemetry.py    # Routes télémétrie
│   │   │   │   ├── users.py        # Routes utilisateurs
│   │   │   │   └── fleets.py       # Routes flottes
│   │   │   │
│   │   │   └── api.py              # Router principal v1
│   │
│   ├── core/                       # CORE INFRASTRUCTURE
│   │   ├── __init__.py
│   │   ├── security.py             # JWT, hashing, RBAC
│   │   ├── logging.py              # Configuration des logs
│   │   ├── exceptions.py           # Exceptions personnalisées
│   │   └── middleware.py           # Middlewares (rate limit, CORS)
│   │
│   ├── models/                     # DOMAIN LAYER (Entities)
│   │   ├── __init__.py
│   │   ├── user.py                 # Modèle SQLAlchemy User
│   │   ├── vehicle.py              # Modèle SQLAlchemy Vehicle
│   │   ├── fleet.py                # Modèle SQLAlchemy Fleet
│   │   ├── alert.py                # Modèle SQLAlchemy Alert
│   │   ├── dtc.py                  # Modèle MongoDB DTC
│   │   └── telemetry.py            # Modèle TimescaleDB Telemetry
│   │
│   ├── schemas/                    # DTOs (Data Transfer Objects)
│   │   ├── __init__.py
│   │   ├── auth.py                 # Pydantic UserLogin, UserRegister, Token
│   │   ├── vehicle.py              # Pydantic VehicleCreate, VehicleResponse
│   │   ├── dtc.py                  # Pydantic DTCResponse, DTCHistory
│   │   ├── alert.py                # Pydantic AlertCreate, AlertResponse
│   │   ├── telemetry.py            # Pydantic TelemetryData
│   │   └── user.py                 # Pydantic UserCreate, UserUpdate
│   │
│   ├── services/                   # APPLICATION LAYER (Business Logic)
│   │   ├── __init__.py
│   │   ├── auth_service.py         # Logique d'authentification
│   │   ├── vehicle_service.py      # Logique métier véhicules
│   │   ├── dtc_service.py          # Décodage et analyse DTC
│   │   ├── alert_service.py        # Génération et gestion des alertes
│   │   ├── telemetry_service.py    # Traitement télémétrie
│   │   └── user_service.py         # Gestion des utilisateurs
│   │
│   ├── repositories/               # INFRASTRUCTURE LAYER (Data Access)
│   │   ├── __init__.py
│   │   ├── base.py                 # Repository abstrait (interface)
│   │   ├── user_repo.py            # Repository PostgreSQL User
│   │   ├── vehicle_repo.py         # Repository PostgreSQL Vehicle
│   │   ├── dtc_repo.py             # Repository MongoDB DTC
│   │   └── telemetry_repo.py       # Repository TimescaleDB Telemetry
│   │
│   ├── db/                         # DATABASE CONNECTIONS
│   │   ├── __init__.py
│   │   ├── postgres.py             # Connexion PostgreSQL (SQLAlchemy)
│   │   ├── mongodb.py              # Connexion MongoDB (Motor)
│   │   ├── redis.py                # Connexion Redis
│   │   └── timescaledb.py          # Connexion TimescaleDB
│   │
│   └── utils/                      # UTILITIES
│       ├── __init__.py
│       ├── validators.py           # Validateurs personnalisés
│       ├── helpers.py              # Fonctions utilitaires
│       └── constants.py            # Constantes (codes erreur, etc.)
│
├── alembic/                        # DATABASE MIGRATIONS
│   ├── versions/
│   │   └── 001_initial.py
│   ├── env.py
│   └── alembic.ini
│
├── tests/                          # TESTS
│   ├── __init__.py
│   ├── conftest.py                 # Fixtures pytest
│   ├── unit/
│   │   ├── test_auth_service.py
│   │   ├── test_vehicle_service.py
│   │   └── test_dtc_service.py
│   ├── integration/
│   │   ├── test_auth_endpoints.py
│   │   ├── test_vehicle_endpoints.py
│   │   └── test_dtc_endpoints.py
│   └── load/
│       └── locustfile.py           # Tests de charge
│
├── .env                            # Variables d'environnement
├── .env.example                    # Template des variables
├── requirements.txt                # Dépendances Python
├── Dockerfile                      # Image Docker
├── docker-compose.yml              # Orchestration locale
├── pyproject.toml                  # Configuration Black, pytest
└── README.md                       # Documentation du backend
```

### 4.2 Fichier de Configuration (.env)

```env
# Application
APP_NAME=MALLOULIAUTO API
APP_VERSION=1.0.0
DEBUG=True
ENVIRONMENT=development

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=4

# Security
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
POSTGRES_DB=mallouliauto

# MongoDB
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=admin
MONGO_PASSWORD=yourpassword
MONGO_DB=mallouliauto

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=yourpassword
REDIS_DB=0

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/api.log

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

---

## 5. Conception des Endpoints API

### 5.1 Module Authentification (`/api/v1/auth`)

#### 5.1.1 POST /api/v1/auth/register

**Description**: Inscription d'un nouvel utilisateur

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe",
  "phone": "+216 98 123 456",
  "role": "driver"
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "driver",
  "created_at": "2026-02-10T10:30:00Z"
}
```

**Validations**:
- Email valide et unique
- Mot de passe: minimum 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial
- Rôle: `admin`, `manager`, `driver`

**Code d'implémentation**:
```python
# app/api/v1/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.auth import UserRegister, UserResponse
from app.services.auth_service import AuthService
from app.dependencies import get_auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserRegister,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Inscription d'un nouvel utilisateur.
    
    - **email**: Email unique et valide
    - **password**: Minimum 8 caractères avec majuscule, chiffre, caractère spécial
    - **full_name**: Nom complet de l'utilisateur
    - **role**: driver (default), manager, ou admin
    """
    return await auth_service.register_user(user_data)
```

#### 5.1.2 POST /api/v1/auth/login

**Description**: Connexion utilisateur et génération des tokens JWT

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": "uuid-123",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "driver"
  }
}
```

**Erreurs**:
- `401 Unauthorized`: Email ou mot de passe incorrect
- `403 Forbidden`: Compte désactivé

#### 5.1.3 POST /api/v1/auth/refresh

**Description**: Renouvellement de l'access token avec un refresh token valide

**Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### 5.2 Module Véhicules (`/api/v1/vehicles`)

#### 5.2.1 GET /api/v1/vehicles

**Description**: Liste de tous les véhicules (avec pagination et filtres)

**Query Parameters**:
- `page` (int, default=1): Numéro de page
- `size` (int, default=20): Nombre d'éléments par page
- `status` (string): Filtrer par statut (healthy, warning, critical)
- `fleet_id` (uuid): Filtrer par flotte
- `search` (string): Recherche par VIN, plaque, modèle

**Response (200 OK)**:
```json
{
  "total": 150,
  "page": 1,
  "size": 20,
  "pages": 8,
  "items": [
    {
      "id": "uuid-vehicle-1",
      "vin": "1HGBH41JXMN109186",
      "license_plate": "TUN-123-456",
      "make": "Toyota",
      "model": "Corolla",
      "year": 2022,
      "mileage": 45000,
      "status": "healthy",
      "last_connection": "2026-02-10T09:15:00Z",
      "active_dtc_count": 0,
      "fleet_id": "uuid-fleet-1",
      "fleet_name": "Flotte Livraison"
    }
  ]
}
```

**RBAC**:
- **Admin**: Tous les véhicules
- **Manager**: Véhicules de ses flottes
- **Driver**: Uniquement son véhicule assigné

#### 5.2.2 POST /api/v1/vehicles

**Description**: Création d'un nouveau véhicule

**Request Body**:
```json
{
  "vin": "1HGBH41JXMN109186",
  "license_plate": "TUN-123-456",
  "make": "Toyota",
  "model": "Corolla",
  "year": 2022,
  "mileage": 45000,
  "fleet_id": "uuid-fleet-1",
  "dongle_id": "DONGLE-ABC-123"
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid-vehicle-1",
  "vin": "1HGBH41JXMN109186",
  "license_plate": "TUN-123-456",
  "make": "Toyota",
  "model": "Corolla",
  "year": 2022,
  "mileage": 45000,
  "status": "pending",
  "fleet_id": "uuid-fleet-1",
  "dongle_id": "DONGLE-ABC-123",
  "created_at": "2026-02-10T10:45:00Z"
}
```

**Validations**:
- VIN: Exactement 17 caractères alphanumériques
- Année: Entre 1990 et année actuelle + 1
- Plaque d'immatriculation unique
- Dongle ID unique

#### 5.2.3 GET /api/v1/vehicles/{id}/status

**Description**: Statut en temps réel d'un véhicule

**Response (200 OK)**:
```json
{
  "vehicle_id": "uuid-vehicle-1",
  "status": "warning",
  "last_update": "2026-02-10T11:00:00Z",
  "location": {
    "latitude": 36.8065,
    "longitude": 10.1815,
    "address": "Tunis, Tunisia"
  },
  "telemetry": {
    "speed": 65,
    "rpm": 2500,
    "fuel_level": 45,
    "engine_temp": 92,
    "battery_voltage": 13.8
  },
  "active_dtc": [
    {
      "code": "P0420",
      "description": "Catalyst System Efficiency Below Threshold",
      "severity": "warning",
      "timestamp": "2026-02-10T08:30:00Z"
    }
  ],
  "active_alerts": 2,
  "mileage": 45123
}
```

### 5.3 Module DTC (`/api/v1/dtc`)

#### 5.3.1 GET /api/v1/dtc/{vehicle_id}

**Description**: Codes DTC actifs pour un véhicule

**Response (200 OK)**:
```json
{
  "vehicle_id": "uuid-vehicle-1",
  "active_dtc_count": 2,
  "dtc_codes": [
    {
      "code": "P0420",
      "description": "Catalyst System Efficiency Below Threshold",
      "category": "Powertrain",
      "severity": "warning",
      "first_detected": "2026-02-10T08:30:00Z",
      "last_occurrence": "2026-02-10T11:00:00Z",
      "occurrence_count": 3,
      "recommended_action": "Vérifier le convertisseur catalytique et les capteurs d'oxygène"
    },
    {
      "code": "B1342",
      "description": "ECM Lower Power Supply Out Of Range",
      "category": "Body",
      "severity": "critical",
      "first_detected": "2026-02-10T10:15:00Z",
      "last_occurrence": "2026-02-10T11:00:00Z",
      "occurrence_count": 1,
      "recommended_action": "Contrôle urgent de l'alimentation électrique ECM"
    }
  ]
}
```

#### 5.3.2 GET /api/v1/dtc/{id}/history

**Description**: Historique complet d'un code DTC

**Response (200 OK)**:
```json
{
  "dtc_code": "P0420",
  "vehicle_id": "uuid-vehicle-1",
  "total_occurrences": 5,
  "history": [
    {
      "start_date": "2026-02-10T08:30:00Z",
      "end_date": "2026-02-10T09:00:00Z",
      "duration_minutes": 30,
      "mileage_at_detection": 45050,
      "resolved": true
    },
    {
      "start_date": "2026-02-10T10:15:00Z",
      "end_date": null,
      "duration_minutes": null,
      "mileage_at_detection": 45120,
      "resolved": false
    }
  ]
}
```

### 5.4 Module Alertes (`/api/v1/alerts`)

#### 5.4.1 GET /api/v1/alerts

**Description**: Liste des alertes actives

**Query Parameters**:
- `vehicle_id` (uuid): Filtrer par véhicule
- `type` (string): Type d'alerte (fuel, temperature, dtc, etc.)
- `severity` (string): Sévérité (info, warning, critical)
- `status` (string): Statut (pending, acknowledged, resolved)

**Response (200 OK)**:
```json
{
  "total": 15,
  "pending": 8,
  "acknowledged": 5,
  "resolved": 2,
  "alerts": [
    {
      "id": "uuid-alert-1",
      "vehicle_id": "uuid-vehicle-1",
      "vehicle_plate": "TUN-123-456",
      "type": "temperature",
      "severity": "critical",
      "title": "Température moteur élevée",
      "message": "Température moteur: 105°C (seuil: 100°C)",
      "status": "pending",
      "created_at": "2026-02-10T11:00:00Z",
      "acknowledged_at": null,
      "acknowledged_by": null
    }
  ]
}
```

#### 5.4.2 POST /api/v1/alerts/ack

**Description**: Acquitter une alerte

**Request Body**:
```json
{
  "alert_id": "uuid-alert-1",
  "note": "Véhicule mis en maintenance, problème en cours de résolution"
}
```

**Response (200 OK)**:
```json
{
  "id": "uuid-alert-1",
  "status": "acknowledged",
  "acknowledged_at": "2026-02-10T11:30:00Z",
  "acknowledged_by": "uuid-user-1",
  "note": "Véhicule mis en maintenance, problème en cours de résolution"
}
```

### 5.5 Module Télémétrie (`/api/v1/telemetry`)

#### 5.5.1 GET /api/v1/telemetry/{vehicle_id}

**Description**: Données de télémétrie historiques

**Query Parameters**:
- `start` (datetime): Date de début (ISO 8601)
- `end` (datetime): Date de fin (ISO 8601)
- `metrics` (array): Métriques à récupérer (speed, rpm, fuel_level, etc.)
- `interval` (string): Intervalle d'agrégation (1m, 5m, 1h, 1d)

**Response (200 OK)**:
```json
{
  "vehicle_id": "uuid-vehicle-1",
  "start": "2026-02-10T00:00:00Z",
  "end": "2026-02-10T23:59:59Z",
  "interval": "1h",
  "data": {
    "engine_temp": [
      {"timestamp": "2026-02-10T00:00:00Z", "value": 85.5, "unit": "°C"},
      {"timestamp": "2026-02-10T01:00:00Z", "value": 88.2, "unit": "°C"}
    ],
    "fuel_level": [
      {"timestamp": "2026-02-10T00:00:00Z", "value": 75, "unit": "%"},
      {"timestamp": "2026-02-10T01:00:00Z", "value": 72, "unit": "%"}
    ]
  }
}
```

---

## 6. Authentification et Sécurité

### 6.1 Flux d'Authentification JWT

```
┌─────────────┐                                   ┌─────────────┐
│  Client     │                                   │   Backend   │
│  (App)      │                                   │   (API)     │
└─────────────┘                                   └─────────────┘
      │                                                   │
      │  1. POST /auth/login                             │
      │  { email, password }                             │
      ├──────────────────────────────────────────────────>
      │                                                   │
      │                           2. Vérification        │
      │                           credentials + bcrypt   │
      │                                                   │
      │  3. { access_token, refresh_token }              │
      │<──────────────────────────────────────────────────
      │                                                   │
      │  4. Stockage tokens (AsyncStorage)               │
      │                                                   │
      │  5. Requête protégée                             │
      │  Authorization: Bearer {access_token}            │
      ├──────────────────────────────────────────────────>
      │                                                   │
      │                           6. Validation JWT      │
      │                           + vérification exp     │
      │                                                   │
      │  7. Réponse avec données                         │
      │<──────────────────────────────────────────────────
      │                                                   │
      │  8. Token expiré (401)                           │
      │<──────────────────────────────────────────────────
      │                                                   │
      │  9. POST /auth/refresh                           │
      │  { refresh_token }                               │
      ├──────────────────────────────────────────────────>
      │                                                   │
      │  10. { access_token }                            │
      │<──────────────────────────────────────────────────
      │                                                   │
```

### 6.2 Structure du Token JWT

**Access Token Payload**:
```json
{
  "sub": "uuid-user-123",
  "email": "user@example.com",
  "role": "manager",
  "fleet_ids": ["uuid-fleet-1", "uuid-fleet-2"],
  "type": "access",
  "exp": 1707566400,
  "iat": 1707565500
}
```

**Refresh Token Payload**:
```json
{
  "sub": "uuid-user-123",
  "type": "refresh",
  "exp": 1708171200,
  "iat": 1707565500
}
```

### 6.3 Implémentation de la Sécurité

```python
# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

# Configuration du hachage de mot de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configuration du schéma Bearer
security = HTTPBearer()

def hash_password(password: str) -> str:
    """Hacher un mot de passe avec bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifier un mot de passe contre son hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Générer un JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Générer un JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """Décoder et valider un JWT"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Dépendance pour obtenir l'utilisateur actuel depuis le JWT"""
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Type de token invalide"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide"
        )
    
    return payload
```

---

## 7. Contrôle d'Accès RBAC

### 7.1 Matrice des Permissions

| Endpoint | Admin | Manager | Driver |
|----------|-------|---------|--------|
| **Authentification** | | | |
| POST /auth/register | ✅ | ✅ | ✅ |
| POST /auth/login | ✅ | ✅ | ✅ |
| POST /auth/refresh | ✅ | ✅ | ✅ |
| **Véhicules** | | | |
| GET /vehicles | ✅ Tous | ✅ Ses flottes | ✅ Son véhicule |
| POST /vehicles | ✅ | ✅ | ❌ |
| PUT /vehicles/{id} | ✅ | ✅ Ses flottes | ❌ |
| DELETE /vehicles/{id} | ✅ | ❌ | ❌ |
| GET /vehicles/{id}/status | ✅ | ✅ Ses flottes | ✅ Son véhicule |
| **DTC** | | | |
| GET /dtc | ✅ Tous | ✅ Ses flottes | ✅ Son véhicule |
| GET /dtc/{vehicle_id} | ✅ | ✅ Ses flottes | ✅ Son véhicule |
| POST /dtc/clear | ✅ | ✅ Ses flottes | ❌ |
| **Alertes** | | | |
| GET /alerts | ✅ Tous | ✅ Ses flottes | ✅ Son véhicule |
| POST /alerts/ack | ✅ | ✅ Ses flottes | ❌ |
| PUT /alerts/{id}/config | ✅ | ✅ Ses flottes | ❌ |
| **Télémétrie** | | | |
| GET /telemetry/{vehicle_id} | ✅ | ✅ Ses flottes | ✅ Son véhicule |
| **Utilisateurs** | | | |
| GET /users | ✅ | ❌ | ❌ |
| PUT /users/{id}/role | ✅ | ❌ | ❌ |
| GET /users/me | ✅ | ✅ | ✅ |
| PUT /users/me | ✅ | ✅ | ✅ |
| **Flottes** | | | |
| GET /fleets | ✅ Tous | ✅ Ses flottes | ❌ |
| POST /fleets | ✅ | ❌ | ❌ |
| PUT /fleets/{id} | ✅ | ✅ Ses flottes | ❌ |
| DELETE /fleets/{id} | ✅ | ❌ | ❌ |

### 7.2 Implémentation RBAC

```python
# app/core/security.py (suite)
from enum import Enum
from typing import List

class Role(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    DRIVER = "driver"

def require_roles(allowed_roles: List[Role]):
    """Décorateur pour vérifier les rôles autorisés"""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissions insuffisantes"
            )
        return current_user
    return role_checker

# Utilisation dans les routes
@router.get("/vehicles")
async def get_vehicles(
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.MANAGER, Role.DRIVER]))
):
    # Logique de filtrage selon le rôle
    if current_user["role"] == Role.DRIVER:
        # Retourner uniquement le véhicule assigné
        pass
    elif current_user["role"] == Role.MANAGER:
        # Retourner les véhicules de ses flottes
        pass
    else:
        # Admin: tous les véhicules
        pass
```

---

## 8. Modèles de Données

### 8.1 Modèle Utilisateur (PostgreSQL)

```python
# app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.postgres import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(Enum('admin', 'manager', 'driver', name='user_roles'), nullable=False, default='driver')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Relation avec les véhicules (si driver)
    assigned_vehicle = relationship("Vehicle", back_populates="driver", uselist=False)
    
    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
```

### 8.2 Schéma Pydantic Utilisateur

```python
# app/schemas/user.py
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional
import re

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None

class UserRegister(UserBase):
    password: str = Field(..., min_length=8, max_length=100)
    role: Optional[str] = "driver"
    
    @validator('password')
    def validate_password(cls, v):
        """Validation sécurité mot de passe"""
        if not re.search(r'[A-Z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une majuscule')
        if not re.search(r'[a-z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une minuscule')
        if not re.search(r'[0-9]', v):
            raise ValueError('Le mot de passe doit contenir au moins un chiffre')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Le mot de passe doit contenir au moins un caractère spécial')
        return v
    
    @validator('role')
    def validate_role(cls, v):
        """Validation des rôles autorisés"""
        allowed_roles = ['admin', 'manager', 'driver']
        if v not in allowed_roles:
            raise ValueError(f'Rôle invalide. Rôles autorisés: {", ".join(allowed_roles)}')
        return v

class UserResponse(UserBase):
    id: str
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
```

### 8.3 Modèle Véhicule (PostgreSQL)

```python
# app/models/vehicle.py
from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.postgres import Base

class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vin = Column(String(17), unique=True, nullable=False, index=True)
    license_plate = Column(String(20), unique=True, nullable=False, index=True)
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    mileage = Column(Integer, default=0)
    status = Column(Enum('healthy', 'warning', 'critical', 'offline', 'pending', name='vehicle_status'), 
                    default='pending')
    last_connection = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Clés étrangères
    fleet_id = Column(UUID(as_uuid=True), ForeignKey('fleets.id'), nullable=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    dongle_id = Column(String(50), unique=True, nullable=True)
    
    # Relations
    fleet = relationship("Fleet", back_populates="vehicles")
    driver = relationship("User", back_populates="assigned_vehicle")
    
    def __repr__(self):
        return f"<Vehicle {self.license_plate} ({self.make} {self.model})>"
```

---

## 9. Gestion des Erreurs

### 9.1 Exceptions Personnalisées

```python
# app/core/exceptions.py
from fastapi import HTTPException, status

class NotFoundException(HTTPException):
    """Ressource non trouvée"""
    def __init__(self, detail: str = "Ressource non trouvée"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class UnauthorizedException(HTTPException):
    """Non autorisé"""
    def __init__(self, detail: str = "Authentification requise"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )

class ForbiddenException(HTTPException):
    """Accès interdit"""
    def __init__(self, detail: str = "Permissions insuffisantes"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

class BadRequestException(HTTPException):
    """Requête invalide"""
    def __init__(self, detail: str = "Requête invalide"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class ConflictException(HTTPException):
    """Conflit (ex: duplication)"""
    def __init__(self, detail: str = "Ressource déjà existante"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)
```

### 9.2 Format de Réponse d'Erreur

```json
{
  "detail": "Erreur détaillée",
  "error_code": "VEHICLE_NOT_FOUND",
  "timestamp": "2026-02-10T12:00:00Z",
  "path": "/api/v1/vehicles/invalid-id"
}
```

### 9.3 Handler Global d'Erreurs

```python
# app/main.py
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from datetime import datetime

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handler pour les erreurs de validation Pydantic"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Données de requête invalides",
            "errors": exc.errors(),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "path": str(request.url)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handler pour les erreurs non gérées"""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Erreur interne du serveur",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "path": str(request.url)
        }
    )
```

---

## 10. Documentation et Tests

### 10.1 Documentation Swagger

FastAPI génère automatiquement la documentation OpenAPI accessible à:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

### 10.2 Tests Unitaires

```python
# tests/unit/test_auth_service.py
import pytest
from app.services.auth_service import AuthService
from app.schemas.auth import UserRegister
from app.core.exceptions import ConflictException, UnauthorizedException

@pytest.mark.asyncio
async def test_register_user_success(auth_service: AuthService):
    """Test inscription réussie"""
    user_data = UserRegister(
        email="test@example.com",
        password="SecurePass123!",
        full_name="Test User",
        role="driver"
    )
    
    result = await auth_service.register_user(user_data)
    
    assert result.email == "test@example.com"
    assert result.role == "driver"
    assert result.is_active is True

@pytest.mark.asyncio
async def test_register_user_duplicate_email(auth_service: AuthService):
    """Test inscription avec email dupliqué"""
    user_data = UserRegister(
        email="duplicate@example.com",
        password="SecurePass123!",
        full_name="Test User"
    )
    
    await auth_service.register_user(user_data)
    
    with pytest.raises(ConflictException):
        await auth_service.register_user(user_data)

@pytest.mark.asyncio
async def test_login_success(auth_service: AuthService):
    """Test connexion réussie"""
    # Créer un utilisateur
    user_data = UserRegister(
        email="login@example.com",
        password="SecurePass123!",
        full_name="Login User"
    )
    await auth_service.register_user(user_data)
    
    # Tenter la connexion
    result = await auth_service.login("login@example.com", "SecurePass123!")
    
    assert result.access_token is not None
    assert result.refresh_token is not None
    assert result.user.email == "login@example.com"

@pytest.mark.asyncio
async def test_login_wrong_password(auth_service: AuthService):
    """Test connexion avec mauvais mot de passe"""
    with pytest.raises(UnauthorizedException):
        await auth_service.login("login@example.com", "WrongPassword")
```

### 10.3 Tests d'Intégration

```python
# tests/integration/test_auth_endpoints.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_register_endpoint():
    """Test endpoint POST /api/v1/auth/register"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePass123!",
                "full_name": "New User",
                "role": "driver"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["role"] == "driver"

@pytest.mark.asyncio
async def test_login_endpoint():
    """Test endpoint POST /api/v1/auth/login"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Créer un utilisateur d'abord
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "logintest@example.com",
                "password": "SecurePass123!",
                "full_name": "Login Test"
            }
        )
        
        # Tester la connexion
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "logintest@example.com",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_protected_endpoint_without_token():
    """Test accès à un endpoint protégé sans token"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/users/me")
        
        assert response.status_code == 401
```

### 10.4 Tests de Charge (Locust)

```python
# tests/load/locustfile.py
from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 3)
    token = None
    
    def on_start(self):
        """Connexion avant les tests"""
        response = self.client.post("/api/v1/auth/login", json={
            "email": "loadtest@example.com",
            "password": "SecurePass123!"
        })
        self.token = response.json()["access_token"]
    
    @task(3)
    def get_vehicles(self):
        """Test GET /api/v1/vehicles"""
        self.client.get(
            "/api/v1/vehicles",
            headers={"Authorization": f"Bearer {self.token}"}
        )
    
    @task(2)
    def get_vehicle_status(self):
        """Test GET /api/v1/vehicles/{id}/status"""
        self.client.get(
            "/api/v1/vehicles/uuid-test/status",
            headers={"Authorization": f"Bearer {self.token}"}
        )
    
    @task(1)
    def get_alerts(self):
        """Test GET /api/v1/alerts"""
        self.client.get(
            "/api/v1/alerts",
            headers={"Authorization": f"Bearer {self.token}"}
        )
```

**Commande de test**:
```bash
locust -f tests/load/locustfile.py --host=http://localhost:8000
```

---

## 11. Plan d'Implémentation par Étapes

### Semaine 1: Fondations (Jours 1-5)

#### Jour 1-2: Configuration et Authentification
- [ ] Initialiser le projet FastAPI avec structure modulaire
- [ ] Configurer les connexions aux bases de données (PostgreSQL, MongoDB, Redis)
- [ ] Créer les modèles User (SQLAlchemy) et schémas Pydantic
- [ ] Implémenter les endpoints:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
- [ ] Tester l'authentification JWT avec Swagger UI

#### Jour 3: Gestion des Utilisateurs
- [ ] Créer le service UserService
- [ ] Implémenter les endpoints:
  - `GET /api/v1/users/me`
  - `PUT /api/v1/users/me`
  - `GET /api/v1/users` (Admin only)
  - `PUT /api/v1/users/{id}/role` (Admin only)
- [ ] Implémenter le système RBAC complet
- [ ] Écrire les tests unitaires pour UserService

#### Jour 4: Gestion des Véhicules
- [ ] Créer les modèles Vehicle, Fleet (SQLAlchemy)
- [ ] Créer les schémas Pydantic (VehicleCreate, VehicleResponse, etc.)
- [ ] Implémenter VehicleService et VehicleRepository
- [ ] Développer les endpoints:
  - `GET /api/v1/vehicles` (avec pagination et filtres)
  - `POST /api/v1/vehicles`
  - `GET /api/v1/vehicles/{id}`
  - `PUT /api/v1/vehicles/{id}`
  - `DELETE /api/v1/vehicles/{id}`
- [ ] Tester les endpoints avec différents rôles (Admin, Manager, Driver)

#### Jour 5: Statut Véhicule en Temps Réel
- [ ] Créer le modèle Telemetry (TimescaleDB)
- [ ] Implémenter TelemetryService
- [ ] Développer l'endpoint:
  - `GET /api/v1/vehicles/{id}/status`
- [ ] Intégrer les données GPS, télémétrie, DTC actifs
- [ ] Optimiser les requêtes avec cache Redis

### Semaine 2: Diagnostics et Alertes (Jours 6-10)

#### Jour 6: Module DTC
- [ ] Créer le modèle DTC (MongoDB)
- [ ] Implémenter DTCService avec décodeur de codes
- [ ] Développer les endpoints:
  - `GET /api/v1/dtc`
  - `GET /api/v1/dtc/{vehicle_id}`
  - `GET /api/v1/dtc/{id}/history`
- [ ] Créer une base de données de codes DTC (P0420, B1342, etc.)
- [ ] Tester le décodage et la catégorisation des DTC

#### Jour 7: Module Alertes
- [ ] Créer le modèle Alert (PostgreSQL)
- [ ] Implémenter AlertService avec logique de génération
- [ ] Développer les endpoints:
  - `GET /api/v1/alerts`
  - `POST /api/v1/alerts/ack`
  - `GET /api/v1/alerts/{vehicle_id}`
- [ ] Implémenter les types d'alertes (fuel, temperature, dtc, etc.)
- [ ] Configurer les seuils d'alerte

#### Jour 8: Télémétrie Historique
- [ ] Créer le schéma TimescaleDB pour télémétrie
- [ ] Implémenter TelemetryService (historique)
- [ ] Développer l'endpoint:
  - `GET /api/v1/telemetry/{vehicle_id}` (avec filtres date, métriques)
- [ ] Optimiser les requêtes TimescaleDB (agrégation par intervalle)
- [ ] Tester la récupération de grandes quantités de données

#### Jour 9: Module Flottes
- [ ] Créer les modèles et schémas Fleet
- [ ] Implémenter FleetService
- [ ] Développer les endpoints:
  - `GET /api/v1/fleets`
  - `POST /api/v1/fleets`
  - `GET /api/v1/fleets/{id}`
  - `PUT /api/v1/fleets/{id}`
  - `DELETE /api/v1/fleets/{id}`
  - `GET /api/v1/fleets/{id}/vehicles`
  - `POST /api/v1/fleets/{id}/vehicles`

#### Jour 10: Tests et Optimisation
- [ ] Écrire les tests unitaires pour tous les services
- [ ] Écrire les tests d'intégration pour tous les endpoints
- [ ] Tester les performances avec Locust (objectif: 1000 req/s)
- [ ] Optimiser les requêtes lentes (ajout d'indexes, cache)
- [ ] Audit de sécurité OWASP

### Semaine 3: Finalisation (Jours 11-14)

#### Jour 11-12: Rate Limiting et Middleware
- [ ] Implémenter le rate limiting (100 req/min par utilisateur)
- [ ] Configurer CORS pour l'application mobile
- [ ] Ajouter le middleware de logging des requêtes
- [ ] Configurer la rotation des logs

#### Jour 13: Documentation
- [ ] Compléter les docstrings de tous les endpoints
- [ ] Générer la documentation OpenAPI complète
- [ ] Écrire le README du backend (installation, configuration, déploiement)
- [ ] Créer des exemples de requêtes Postman/cURL

#### Jour 14: Déploiement et CI/CD
- [ ] Créer le Dockerfile optimisé
- [ ] Configurer docker-compose pour développement local
- [ ] Mettre en place les migrations Alembic
- [ ] Préparer les scripts de déploiement Azure
- [ ] Configurer les secrets (Azure Key Vault)

---

## 12. Checklist de Validation Finale

### Sécurité ✅
- [ ] Tous les endpoints protégés nécessitent un JWT valide
- [ ] Les mots de passe sont hachés avec bcrypt
- [ ] Le RBAC est correctement implémenté
- [ ] Les variables sensibles sont dans .env (pas de hardcoding)
- [ ] TLS/HTTPS est configuré
- [ ] Rate limiting est actif
- [ ] Les tokens expirent correctement
- [ ] Les logs ne contiennent pas de données sensibles

### Performance ✅
- [ ] Temps de réponse API < 500ms (p95)
- [ ] Support de 1000+ requêtes/seconde
- [ ] Les requêtes lourdes utilisent le cache Redis
- [ ] Les requêtes SQL sont optimisées (indexes)
- [ ] Pagination active sur tous les endpoints de liste

### Tests ✅
- [ ] Couverture de tests > 80%
- [ ] Tous les tests unitaires passent
- [ ] Tous les tests d'intégration passent
- [ ] Tests de charge réussis (Locust)

### Documentation ✅
- [ ] Swagger UI accessible et complet
- [ ] README clair avec instructions d'installation
- [ ] Exemples de requêtes fournis
- [ ] Diagrammes d'architecture à jour

---

## Conclusion

Ce document fournit une **roadmap complète** pour le développement de l'API et Backend de la plateforme **MALLOULIAUTO**. En suivant cette méthodologie structurée et en respectant les bonnes pratiques (SOLID, RBAC, tests), l'objectif est de livrer une API **robuste, sécurisée, et scalable** en **2 semaines** (Sprint 3).

**Points clés à retenir**:
1. ✅ **Commencer par l'authentification** (base de tout le système)
2. ✅ **Développer module par module** (itératif)
3. ✅ **Tester continuellement** (pas de dette technique)
4. ✅ **Documenter au fur et à mesure** (pas à la fin)
5. ✅ **Optimiser dès le début** (cache, indexes, RBAC)

**Prochaines étapes**:
- Lire ce document attentivement
- Configurer l'environnement de développement
- Commencer par le Jour 1 du plan d'implémentation
- Suivre le workflow de développement par endpoint

**Ressources utiles**:
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/en/20/)
- [JWT.io](https://jwt.io/) - Décodeur de tokens
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

**Dernière mise à jour**: Février 10, 2026  
**Auteur**: Imen Mallouli  
**Version**: 1.0
