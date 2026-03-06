# Design

**Author** : imen mallouli 
**Date** : February 4, 2026  
**Project** : Automotive Diagnostic IoT Cloud Platform  
**Phase** : Backend Architecture Design

---

## Project Definition

This project aims to design and develop the **complete backend and cloud infrastructure** of an intelligent automotive fleet IoT platform named **MALLOULIAUTO**. The solution collects, stores, processes, and serves real-time telemetry data from OBD (On-Board Diagnostics) dongles installed on fleet vehicles, giving managers full visibility into vehicle health and enabling predictive maintenance.

The system relies on a **scalable and resilient cloud microservices architecture** capable of handling thousands of connected vehicles simultaneously. The collected data includes DTC fault codes and detailed telemetry (speed, RPM, temperature, battery, fuel consumption). This information is ingested via lightweight IoT protocols (MQTT, HTTP, WebSocket), validated, and routed to a hybrid storage system optimized for different data types.

**Automotive diagnostics** is central to the platform. The system analyzes **DTC fault codes** transmitted by OBD dongles in real time to identify mechanical issues and anomalies: engine, transmission, brakes, sensors, electrical system. Each DTC is decoded, enriched with its technical description and severity (critical, warning, info), and linked to recommended corrective actions. The backend stores full diagnostic history per vehicle, enabling longitudinal tracking of failures, detection of recurring issues, and correlation between anomalies and driving behavior (for example, engine overheating linked to aggressive driving detected via telemetry). Diagnostic alerts are prioritized by urgency and sent in real time to fleet managers via the mobile app and to drivers via notifications, enabling **rapid intervention before escalation** and reducing unplanned maintenance costs.

**Visual exploitation of diagnostic and telemetry data** is a core element of the mobile app. The backend transforms raw stored data (DTC, GPS, telemetry) into **interactive and understandable visualizations** to support decision making. Fleet managers access **time series curves** showing critical parameter evolution: engine temperature over the last 7 days, fuel consumption per trip, tire pressure variation, battery level. **Analytics charts** highlight abnormal trends (recurring temperature spikes, fuel overconsumption, progressive degradation) and detect early signs of failures. The system also generates **summary dashboards** with key performance indicators (KPI): number of active DTC codes per vehicle, frequency of critical alerts, fleet availability rate, estimated maintenance costs. Geographic data is projected on **interactive maps** (react-native-maps/OpenStreetMap) showing the real-time position of each vehicle with color status (green: healthy, orange: warning, red: critical). **Histograms and pie charts** compare performance between vehicles, identify the most problematic vehicles, and show the distribution of failure types. All these visualizations are updated automatically via WebSocket to reflect real-time fleet status.

The project covers four major technical components:

1. **Cloud microservices architecture design**: Define the global architecture, select Azure cloud technologies, orchestrate with Docker and Kubernetes, and set up infrastructure as code (Terraform).

2. **Backend and API development**: Build a secure RESTful API using Python (FastAPI) for dongle-cloud communication, implement JWT authentication and role-based authorization, and manage real-time data ingestion with validation and deduplication.

3. **Hybrid storage system**: Configure and optimize PostgreSQL for structured data (vehicles, users, fleets), MongoDB for documents (DTC codes, raw payloads), and TimescaleDB or InfluxDB for time-series data (telemetry history), with partitioning and retention strategies.

4. **Administrator mobile app development**: Fleet management interface in React Native with real-time visualizations (Victory Native charts, customizable dashboards), allowing managers to monitor their fleet, consult alerts, and plan maintenance.

The main objective is to ensure a **high-performance, secure, and scalable** infrastructure, capable of growing from 100 vehicles in the initial phase to more than 10,000 vehicles, while maintaining ingestion latency under 5 seconds and 99.5% availability.

---

## Goals to Achieve

### 1. Architecture and Scalability

| Goal | Success Criteria |
|----------|-------------------|
| Modular microservices architecture | Decoupled services, independently deployable |
| Horizontal scalability | Support 100+ vehicles phase 1 -> 10,000+ phase 2 |
| High availability | Uptime 99.5% minimum (SLA defined) |
| Ingestion latency | < 5 seconds from dongle to storage |
| API performance | Response time < 500ms (p95) |

### 2. Security and Authentication

| Goal | Success Criteria |
|----------|-------------------|
| Strong authentication | JWT + OAuth2 for all endpoints |
| Communication encryption | TLS 1.3 for all connections |
| Data at rest protection | PostgreSQL and MongoDB encryption |
| Complete audit trail | Centralized logs of all access |
| GDPR compliance | Management of personal data (GPS, users) |

### 3. Real-Time Data Ingestion

| Goal | Success Criteria |
|----------|-------------------|
| Multi-protocol support | MQTT (primary), HTTP (fallback), WebSocket (app) |
| Data validation | Reject malformed payloads, deduplication |
| Smart routing | Automatic distribution SQL/NoSQL/TimeSeries |
| Fault resilience | Retry with exponential backoff |
| High throughput | 1000+ messages/second per service |

### 4. Data Storage and Management

| Goal | Success Criteria |
|----------|-------------------|
| Optimized hybrid architecture | PostgreSQL + MongoDB + TimescaleDB/InfluxDB |
| Fast queries | Response time < 200ms for 90% of queries |
| Smart retention | Hot data (7 days), warm (30 days), cold (1 year+) |
| Automatic backup | Daily snapshots, tested monthly |
| Efficient partitioning | Time-series partitioned by date |

### 5. Mobile App Dashboard

| Goal | Success Criteria |
|----------|-------------------|
| Intuitive interface | Responsive mobile app React Native + NativeWind |
| Interactive charts | Victory Native or react-native-svg for metrics |
| Mobile performance | 60fps frame rate, bundle size < 50MB |
| Compatibility | Support iOS 14+, Android 8+ |

#### 5.1 Detailed Mobile App Features

**Module 1: Real-Time Dashboard**
- **Vehicle list**: Filterable/sortable list with real-time status
- **Dynamic KPIs**: Active alerts, healthy vehicles, estimated maintenance costs, availability rate
- **WebSocket updates**: Automatic push of status changes (< 2 seconds)

**Module 2: Vehicle Management**
- **Vehicle CRUD**: Registration (make, model, VIN, plate, year, mileage)
- **Updates**: Update information, add photos/documents
- **Dongle association**: Link/unlink OBD dongles with timestamp and reason
- **Dongle transfer**: Reassign between vehicles while preserving history
- **Deactivation**: Soft delete with data archiving

**Module 3: Automotive Diagnostics (DTC)**
- **Active fault codes**: List of current DTCs with code, description, severity
- **Automatic decoding**: P0420 -> "Catalyst System Efficiency Below Threshold"
- **DTC history**: Full timeline per vehicle with start/end dates
- **Recurring codes**: Automatic detection (3 occurrences in 7 days)
- **Recommendations**: Suggested corrective actions per fault code
- **Diagnostic export**: PDF details for workshops

**Module 4: Visualizations and Analytics**
- **Telemetry charts**:
  - Engine temperature over 7/30 days
  - Fuel consumption per trip/period
  - Battery level (voltage) with alert thresholds
  - Engine RPM with abnormal peaks
- **Time series**: Selectable ranges (24h, 7d, 30d, custom)
- **Trip history**: Map replay with timeline and speed
- **Comparison**: Performance between vehicles (fuel efficiency, incidents)
- **Heatmaps**: Frequented geographic zones, risk areas

**Module 5: Alert System**
- **In-app notifications**: Real-time banner with "Acknowledge" button
- **Threshold configuration**: Per-vehicle customization (temperature > X C, fuel < Y%)
- **Alert types**: 10 categories (fuel, temperature, battery, DTC, tires, brakes, speed, geofencing, maintenance, recurrence)
- **Alert history**: Filter by vehicle, type, status (pending/acknowledged/resolved)
- **Quick actions**: Acknowledge, schedule maintenance, configure alerts
- **Notification channels**: Email, SMS (via API), WebSocket push

**Module 6: User Management (Admin)**
- **User CRUD**: Create, update, deactivate accounts
- **Roles and permissions**: Admin, Manager, Maintenance Analyst, Read-only (RBAC)
- **Audit trail**: Login logs (IP, timestamp, success/failure)
- **Fleet assignment**: Access restriction by vehicle group

**Module 8: Search and Filters**
- **Global search**: By VIN, plate, dongle ID
- **Advanced filters**: Status, fleet, active alert, date, DTC type
- **Saved filters**: Reusable custom views

### 6. DevOps and Observability

| Goal | Success Criteria |
|----------|-------------------|
| Infrastructure as Code | Terraform for Azure provisioning |
| Automated CI/CD | GitHub Actions (test, build, deploy) |
| Full monitoring | Prometheus + Grafana for all metrics |
| Centralized logging | ELK Stack or Loki for log aggregation |
| Automatic alerts | Notifications on performance degradation |

---
---

## Existing Solutions Study

### 1. Commercial Market Solutions

Existing fleet management platforms (Verizon Connect, Samsara, Geotab, TomTom Telematics) offer advanced features (GPS tracking, alerts, reports) but are mostly oriented toward international markets with high budgets. They provide integrated solutions, but with high costs and integration constraints.

### 2. Open-Source Solutions

Solutions such as **Traccar** or **OpenGTS** provide basic GPS tracking but are limited in:
- OBD diagnostics (DTC)
- predictive intelligence
- advanced visualization and customization

### 3. Available Technologies

Common stacks for this type of project include:
- **Backend**: FastAPI
- **Databases**: PostgreSQL, MongoDB, InfluxDB/TimescaleDB
- **Frontend**: React Native
- **IoT communication**: MQTT

---

## Existing Analysis

### 1. Limits of Current Solutions

- **High cost**: not suitable for local SMEs
- **Low customization**: rigid models, poor adaptation to Tunisian context
- **Proprietary cloud dependency**: vendor lock-in
- **Limited diagnostic integration**: focused on GPS, little on DTC

### 2. Uncovered Needs

- Real-time automotive diagnostics with DTC history
- Intelligent data visualization (curves, KPI, alerts)
- Microservices approach for scalability
- Efficient operation on unstable 3G/4G networks

---

## Critique of Existing Solutions

Existing solutions do not effectively meet the specific requirements of a Tunisian fleet:

- **Non-competitive pricing** relative to local purchasing power
- **Lack of predictive intelligence** in open-source solutions
- **Low adaptability** to connectivity and localization constraints
- **Missing full IoT integration** for diagnostics and telemetry

These limits justify designing a specific solution that is more flexible, scalable, and diagnostics-oriented.

---

## Proposed Solution

### 1. Target Architecture

A cloud **microservices** architecture with:
- **Ingestion service** MQTT/HTTP/WebSocket
- **Secure REST API** (JWT)
- **Hybrid storage** PostgreSQL + MongoDB + TimescaleDB/InfluxDB
- **Mobile app** with real-time maps and charts

### 2. Simplified Data Flow

1. OBD dongle -> MQTT/HTTP
2. Backend validation and filtering
3. Storage by data type (SQL/NoSQL/TimeSeries)
4. REST API + WebSocket -> mobile app

### 3. Expected Results

- Reduced unplanned failures
- Better visibility into vehicle health
- Optimized maintenance costs
- Clear, decision-ready mobile interface

---

## Work Methodology

### 1. Agile Concept (general)

The **Agile** approach is based on **iterative and incremental** work. It favors **flexibility**, **collaboration**, and **adaptation to change** rather than a fixed plan. The project progresses in short cycles (iterations), with partial, validated deliverables that allow rapid adjustments based on feedback and technical constraints.

### 2. Comparative Study of Agile Methods

| Method | Characteristics | Fit for the project |
|---------|------------------|----------------------|
| **Scrum** | Sprints, defined roles, backlog, ceremonies | Suitable solo with merged roles (PO/Dev/Scrum Master) |
| **Kanban** | Continuous flow, limited WIP, task visualization | Simple alternative if continuous flow is needed |
| **XP (Extreme Programming)** | Intensive testing, pair programming | Less suitable solo, strong technical discipline |
| **Lean** | Waste elimination, customer value | Suitable if focus is a fast MVP |
| **FDD** | Feature-driven development | Useful for large projects, less for solo |
| **DSDM** | MoSCoW prioritization, strong governance | More for large enterprise projects |

### 3. Selected Method (Justification)

For an **individual** **PFE** project with a strong technical component (backend, cloud, storage, mobile app), the chosen method is **Scrum**, adapted to solo work with **merged roles**.

- **Why Scrum?**
  - Clear structure with **sprints** (cadence and short goals)
  - Enables regular planning and validation
  - Facilitates continuous adaptation after each iteration

- **Adaptation to solo work**
  - The roles of **Product Owner, Scrum Master, and Developer** are handled by one person
  - Ceremonies are simplified but kept (planning, review, retrospective)

### 4. Project Tracking

Tracking relies on the following Scrum artifacts:
- **Product Backlog**: list of prioritized features
- **Sprint Backlog**: selection of tasks to do in each sprint
- **Sprint Goal**: clear deliverable at the end of the iteration

Sprint organization (example):
- Sprint 1: Ingestion and API
- Sprint 2: Hybrid storage
- Sprint 3: Mobile app
- Sprint 4: Tests and documentation

Each sprint ends with a **review** (validation) and a **retrospective** (continuous improvement).

### 5. Adaptation to Change

The project remains **evolving**:
- Priorities can be adjusted based on progress
- Technical choices (e.g., TimescaleDB vs InfluxDB) can be re-evaluated after prototyping
- Supervisor feedback is integrated after each iteration


### 6. Break Down Diagram - Task Planning

#### 6.1 Work Breakdown Structure (WBS)

```
MALLOULIAUTO - Automotive Diagnostic IoT Platform

 1. INFRASTRUCTURE & CLOUD
   1.1 Azure Configuration
     1.1.1 Create Azure account + Resource Group
     1.1.2 VNet and network security setup
     1.1.3 Load Balancer setup
    
   1.2 Docker Containerization
     1.2.1 Create Dockerfiles for services
     1.2.2 Docker Compose local dev
     1.2.3 Azure Container Registry
    
   1.3 Kubernetes Orchestration
     1.3.1 AKS cluster setup
     1.3.2 Deployment manifests (pods, services)
     1.3.3 ConfigMaps and Secrets
     1.3.4 HPA auto-scaling configuration
    
   1.4 Infrastructure as Code
      1.4.1 Azure Terraform scripts
      1.4.2 Terraform variables and modules
      1.4.3 Azure Storage state backend

 2. BACKEND & API
   2.1 FastAPI Setup
     2.1.1 Python project structure
     2.1.2 Environment variables configuration
     2.1.3 Logging and error handlers
    
   2.2 Ingestion Service
     2.2.1 MQTT Broker (Mosquitto) setup
     2.2.2 MQTT listener and subscribers
     2.2.3 Pydantic schema validation
     2.2.4 Redis deduplication
     2.2.5 Smart Router (SQL/NoSQL/TimeSeries)
    
   2.3 API Service
     2.3.1 REST endpoints /api/v1/*
     2.3.2 JWT Authentication
     2.3.3 RBAC (Role-Based Access Control)
     2.3.4 OpenAPI/Swagger documentation
     2.3.5 Rate limiting and throttling
         
     2.3.6 REST API Endpoints Details
         
     **Vehicle Management** (/api/v1/vehicles)
     - GET    /api/v1/vehicles              -> List all vehicles
     - POST   /api/v1/vehicles              -> Create new vehicle
     - GET    /api/v1/vehicles/{id}         -> Vehicle details
     - PUT    /api/v1/vehicles/{id}         -> Update vehicle
     - DELETE /api/v1/vehicles/{id}         -> Delete vehicle
     - GET    /api/v1/vehicles/{id}/status  -> Real-time status (GPS, km, active DTC)
         
     **DTC Codes** (/api/v1/dtc)
     - GET    /api/v1/dtc                   -> List all active DTCs
     - GET    /api/v1/dtc/{vehicle_id}      -> DTCs for a specific vehicle
     - GET    /api/v1/dtc/{id}/history      -> DTC history
     - POST   /api/v1/dtc/clear             -> Clear resolved DTCs
         
     **Alerts** (/api/v1/alerts)
     - GET    /api/v1/alerts                -> List active alerts
     - POST   /api/v1/alerts/ack            -> Acknowledge an alert
     - GET    /api/v1/alerts/{vehicle_id}   -> Alerts for a vehicle
         
     **Telemetry** (/api/v1/telemetry)
     - GET    /api/v1/telemetry/{vehicle_id}?start=...&end=...  -> Historical data
     - GET    /api/v1/telemetry/{vehicle_id}/latest             -> Latest values
         
     **Users and Authentication** (/api/v1/users, /api/v1/auth)
     - POST   /api/v1/auth/register         -> Create account
     - POST   /api/v1/auth/login            -> Login (returns JWT)
     - POST   /api/v1/auth/refresh          -> Refresh JWT token
     - POST   /api/v1/auth/logout           -> Logout
     - GET    /api/v1/users/me              -> User profile info
     - PUT    /api/v1/users/me              -> Update profile
     - GET    /api/v1/users                 -> List users (Admin only)
     - PUT    /api/v1/users/{id}/role       -> Change role (Admin only)
         
     **Fleets** (/api/v1/fleets)
     - GET    /api/v1/fleets                -> List fleets
     - POST   /api/v1/fleets                -> Create fleet
     - GET    /api/v1/fleets/{id}           -> Fleet details
     - PUT    /api/v1/fleets/{id}           -> Update fleet
     - DELETE /api/v1/fleets/{id}           -> Delete fleet
     - GET    /api/v1/fleets/{id}/vehicles  -> Vehicles in a fleet
     - POST   /api/v1/fleets/{id}/vehicles  -> Add vehicle to fleet
         
     **JWT Authentication Flow**
     1. User POST /api/v1/auth/login -> Receives access_token + refresh_token
     2. App stores tokens (AsyncStorage React Native)
     3. Each request sends header: Authorization: Bearer {access_token}
     4. Backend verifies token + expiration (15min access, 7 days refresh)
     5. If expired -> POST /api/v1/auth/refresh with refresh_token
         
     **RBAC Permissions Matrix**
     | Endpoint | Admin | Manager | Driver |
     |----------|-------|---------|--------|
     | GET /vehicles | ✅ All | ✅ Own fleet | ✅ Own vehicle |
     | POST /vehicles | ✅ | ✅ | ❌ |
     | DELETE /vehicles | ✅ | ❌ | ❌ |
     | GET /alerts | ✅ All | ✅ Own fleet | ✅ Own vehicle |
     | PUT /users/{id}/role | ✅ | ❌ | ❌ |
     | GET /fleets | ✅ All | ✅ Own fleets | ❌ |
    
   2.4 Analytics Service
     2.4.1 DTC code decoder
     2.4.2 Real-time anomaly detection
     2.4.3 Alert generation
     2.4.4 Recommendation engine
     2.4.5 Recurring patterns detection
    
   2.5 Notification Service
     2.5.1 Email integration (SMTP)
     2.5.2 SMS API integration
     2.5.3 WebSocket push notifications
    
   2.6 WebSocket Service
      2.6.1 WebSocket server setup
      2.6.2 Redis Pub/Sub integration
      2.6.3 Subscription management

 3. HYBRID STORAGE
   3.1 PostgreSQL
     3.1.1 Installation and configuration
     3.1.2 Database schema
     3.1.3 Alembic migrations
     3.1.4 Indexes and optimization
     3.1.5 pgcrypto encryption
    
   3.2 MongoDB
     3.2.1 MongoDB Atlas setup
     3.2.2 Collections design (DTC, payloads)
     3.2.3 Indexing strategy
     3.2.4 Field-level encryption
    
   3.3 TimescaleDB/InfluxDB
     3.3.1 Final choice TimescaleDB vs InfluxDB
     3.3.2 Hypertables configuration
     3.3.3 Time partitioning
     3.3.4 Retention policies (hot/warm/cold)
    
   3.4 Redis
     3.4.1 Installation and hardening
     3.4.2 Cache strategy
     3.4.3 Pub/Sub channels
    
   3.5 Backup and Recovery
      3.5.1 Automated backup scripts
      3.5.2 Scheduled snapshots
      3.5.3 Restore tests

 4. MOBILE APP (React Native)
   4.1 Frontend Setup
     4.1.1 Expo / React Native CLI
     4.1.2 TypeScript configuration
     4.1.3 NativeWind / StyleSheet setup
     4.1.4 React Navigation setup
    
   4.2 Authentication UI
     4.2.1 Login page
     4.2.2 JWT token management
     4.2.3 Protected routes
    
     4.3 Main Dashboard
       4.3.1 Responsive layout
       4.3.2 KPI cards (vehicles, alerts, costs)
       4.3.3 WebSocket connection
       4.3.4 Real-time updates
    
     4.4 Vehicle Module
       4.4.1 Vehicle list (filterable table)
       4.4.2 Vehicle CRUD
       4.4.3 Vehicle details
       4.4.4 Dongle association
    
     4.5 DTC Diagnostics Module
       4.5.1 List active DTC codes
       4.5.2 DTC history per vehicle
       4.5.3 Fault code details
       4.5.4 Recommended actions
    
     4.6 Visualizations
       4.6.1 GPS map (react-native-maps)
       4.6.2 Charts (Victory Native)
       4.6.3 Telemetry curves
       4.6.4 Heatmaps and analytics
    
     4.7 Alert System
       4.7.1 Banner notification
       4.7.2 Alert history
       4.7.3 Threshold configuration
       4.7.4 Quick actions
    
     4.8 Admin Module
        4.8.1 User management
        4.8.2 Roles and permissions
        4.8.3 Audit logs viewer

   5. DEVOPS & MONITORING
     5.1 CI/CD
       5.1.1 GitHub Actions workflows
       5.1.2 Automated tests
       5.1.3 Build and push images
       5.1.4 Auto deploy staging/prod
    
     5.2 Monitoring
       5.2.1 Prometheus installation
       5.2.2 Exporters configuration
       5.2.3 Grafana dashboards
       5.2.4 Automatic alerts
    
     5.3 Logging
       5.3.1 ELK Stack setup (or Loki)
       5.3.2 Log aggregation
       5.3.3 Kibana dashboards
    
     5.4 Security
        5.4.1 TLS certificates
        5.4.2 Secrets management
        5.4.3 Security scanning

   6. TESTS & DOCUMENTATION
      6.1 Backend Tests
        6.1.1 Unit tests (pytest)
        6.1.2 Integration tests
        6.1.3 Performance tests (locust)
        6.1.4 Security tests (OWASP)
     
      6.2 Frontend Tests
        6.2.1 Unit tests (Jest)
        6.2.2 Component tests (React Native Testing Library)
        6.2.3 E2E tests (Detox)
     
      6.3 Documentation
         6.3.1 Full README
         6.3.2 API documentation
         6.3.3 Deployment guide
         6.3.4 Architecture diagrams
         6.3.5 User documentation
```

#### 6.2 MoSCoW Prioritization

| Priority | Category | Components |
|----------|-----------|------------|
| **MUST** (MVP Phase 1) | Base infrastructure | Azure setup, Docker, PostgreSQL, MongoDB, basic FastAPI API |
| **MUST** (MVP Phase 1) | Data ingestion | MQTT listener, validation, storage router |
| **MUST** (MVP Phase 1) | Minimal app | Login, vehicle list, DTC visualization |
| **SHOULD** (Phase 2) | Advanced analytics | Anomaly detection, recommendations, real-time alerts |
| **SHOULD** (Phase 2) | App features | Charts, GPS map, WebSocket updates |
| **COULD** (Phase 3) | Optimizations | Kubernetes HPA, TimescaleDB, advanced caching |
| **COULD** (Phase 3) | Bonus features | Predictive maintenance, ML models, mobile app |
| **WON'T** (Out of scope) | Future features | Blockchain audit, multi-cloud, advanced AI |

#### 6.3 Sprint Timeline Estimate (2 weeks/sprint)

```
Sprint 1 (S1-S2) - Infrastructure and Setup
 Azure environment setup
 Docker containers configuration
 PostgreSQL + MongoDB installation
 FastAPI project structure

Sprint 2 (S3-S4) - Ingestion and Storage
 MQTT Broker setup
 Ingestion Service development
 Data validation and routing
 Database schemas and migrations

Sprint 3 (S5-S6) - API and Authentication
 REST API endpoints (30+ routes)
   - Vehicle CRUD (GET/POST/PUT/DELETE /api/v1/vehicles)
   - DTC and alerts (GET /api/v1/dtc, /api/v1/alerts)
   - Telemetry (GET /api/v1/telemetry/{vehicle_id})
   - Fleets (CRUD /api/v1/fleets)
   - Users (/api/v1/users, /api/v1/auth)
 JWT authentication (access + refresh tokens, 15min/7d)
 RBAC implementation (Admin/Manager/Driver permissions)
 OpenAPI documentation (auto-generated Swagger)

Sprint 4 (S7-S8) - Analytics and DTC
 DTC decoder implementation
 Analytics Service
 Alert generation logic
 Notification system

Sprint 5 (S9-S10) - Mobile App Frontend
 React Native setup and authentication UI
 Dashboard layout
 Vehicle management module
 DTC diagnostics display

Sprint 6 (S11-S12) - Visualizations and Real-Time
 Victory charts integration
 react-native-maps
 WebSocket implementation
 Real-time updates

Sprint 7 (S13-S14) - DevOps and Monitoring
 CI/CD pipelines
 Prometheus + Grafana
 ELK Stack logging
 Kubernetes deployment

Sprint 8 (S15-S16) - Tests and Documentation
 Unit tests (backend + frontend)
 Integration tests
 Performance testing
 Complete documentation
```

#### 6.4 Task Dependency Diagram

```mermaid
graph TD
  A[Azure Infrastructure] --> B[Docker Setup]
  B --> C[Databases Setup]
  C --> D[FastAPI Backend]
  D --> E[Ingestion Service]
  D --> F[API Service]
  E --> G[Analytics Service]
  F --> H[Mobile App Frontend]
  G --> I[Notification Service]
  F --> J[WebSocket Service]
  H --> K[Visualizations]
  J --> K
  C --> L[Backup Systems]
  D --> M[CI/CD Pipeline]
  M --> N[Monitoring]
  K --> O[E2E Tests]
  N --> P[Production Deployment]
```

#### 6.5 Gantt Diagram - Project Timeline

```mermaid
gantt
    title MALLOULIAUTO Project Timeline (16 weeks)
    dateFormat YYYY-MM-DD
    axisFormat %W
    
    section Sprint 1-2 (Infra)
    Azure and Cloud Setup       :a1, 2026-02-01, 14d
    Docker Configuration        :a2, after a1, 7d
    PostgreSQL + MongoDB        :a3, after a1, 7d
    FastAPI Structure           :a4, after a2, 7d
    
    section Sprint 3-4 (Ingestion)
    MQTT Broker Setup           :b1, after a4, 7d
    Ingestion Service           :b2, after b1, 10d
    Data Validation and Routing :b3, after b2, 7d
    Database Schemas            :b4, after b1, 10d
    
    section Sprint 5-6 (API)
    REST API Endpoints          :c1, after b3, 10d
    JWT Authentication          :c2, after c1, 7d
    RBAC Implementation         :c3, after c2, 7d
    OpenAPI Documentation       :c4, after c1, 7d
    
    section Sprint 7-8 (Analytics)
    DTC Decoder                 :d1, after c3, 10d
    Analytics Service           :d2, after d1, 7d
    Alert Generation            :d3, after d2, 7d
    Notification System         :d4, after d3, 7d
    
    section Sprint 9-10 (Mobile)
    React Native Setup          :e1, after d3, 7d
    Authentication UI           :e2, after e1, 7d
    Dashboard Layout            :e3, after e2, 10d
    DTC Diagnostics Display     :e4, after e3, 7d
    
    section Sprint 11-12 (Visuals)
    Victory Charts Integration  :f1, after e4, 7d
    Maps Integration            :f2, after f1, 7d
    WebSocket Real-Time         :f3, after f2, 10d
    Real-time Updates           :f4, after f3, 7d
    
    section Sprint 13-14 (DevOps)
    CI/CD Pipelines             :g1, after f3, 10d
    Prometheus + Grafana        :g2, after g1, 7d
    ELK Stack Logging           :g3, after g1, 7d
    Kubernetes Deployment       :g4, after g2, 7d
    
    section Sprint 15-16 (Tests)
    Backend Unit Tests          :h1, after g3, 7d
    Frontend Unit Tests         :h2, after g3, 7d
    Integration Tests           :h3, after h1, 10d
    Performance Testing         :h4, after h2, 7d
    Complete Documentation      :h5, after h3, 7d
```

**Important notes:**
- 🔴 **Critical paths**: Infrastructure -> Ingestion -> API -> Analytics -> Mobile App
- ⚠️ **Blocking tasks**: Azure setup, MQTT Broker, JWT auth, React Native setup
- 📊 **Possible parallelization**: Backend/frontend tests, CI/CD + monitoring
- 🎯 **Total estimated duration**: 16 weeks (4 months) for 1 full-stack developer

#### 6.6 Effort Estimation

| WBS Category | Sub-tasks | Estimated Duration | Complexity | Effort (h) | Required Resources |
|---------------|-------------|---------------|------------|-----------|---------------------|
| **1. Infrastructure & Cloud** | | | | | |
| 1.1 Azure Configuration | Account setup, VNet, Load Balancer | 3 days | Medium | 24h | Azure account, networking knowledge |
| 1.2 Docker Containerization | Dockerfiles, Compose | 2 days | Low | 16h | Docker Desktop |
| 1.3 Kubernetes Orchestration | AKS, manifests, HPA | 4 days | High | 32h | Kubernetes CLI, documentation |
| 1.4 Infrastructure as Code | Terraform scripts | 3 days | Medium | 24h | Terraform, Azure provider |
| | | **12 days** | | **96h** | |
| **2. Backend & API** | | | | | |
| 2.1 FastAPI Setup | Project structure, config | 2 days | Low | 16h | Python 3.11, IDE |
| 2.2 Ingestion Service | MQTT, validation, router | 5 days | High | 40h | Mosquitto, Redis |
| 2.3 API Service | REST endpoints, JWT, RBAC | 5 days | High | 40h | FastAPI, SQLAlchemy |
| 2.4 Analytics Service | DTC decoder, anomalies, alerts | 6 days | High | 48h | Business logic, DTC database |
| 2.5 Notification Service | Email, SMS, WebSocket push | 3 days | Medium | 24h | SMTP, Twilio API |
| 2.6 WebSocket Service | Server, Pub/Sub | 3 days | Medium | 24h | WebSockets library, Redis |
| | | **24 days** | | **192h** | |
| **3. Hybrid Storage** | | | | | |
| 3.1 PostgreSQL | Install, schema, migrations | 3 days | Medium | 24h | PostgreSQL 15, Alembic |
| 3.2 MongoDB | Atlas setup, collections | 2 days | Low | 16h | MongoDB Atlas account |
| 3.3 TimescaleDB/InfluxDB | Choice, hypertables, partitioning | 4 days | High | 32h | TimescaleDB extension |
| 3.4 Redis | Install, cache, Pub/Sub | 2 days | Low | 16h | Redis 7 |
| 3.5 Backup and Recovery | Scripts, snapshots, tests | 2 days | Medium | 16h | Cron jobs, storage |
| | | **13 days** | | **104h** | |
| **4. Mobile App** | | | | | |
| 4.1 Frontend Setup | React Native, TypeScript, NativeWind | 2 days | Low | 16h | Node.js, npm/yarn, Expo |
| 4.2 Authentication UI | Login, JWT, protected routes | 2 days | Low | 16h | React Navigation |
| 4.3 Main Dashboard | Layout, KPIs, WebSocket | 3 days | Medium | 24h | Zustand, Axios |
| 4.4 Vehicle Module | CRUD, list, details | 3 days | Medium | 24h | Forms, tables |
| 4.5 DTC Diagnostics Module | List, history, details | 3 days | Medium | 24h | API integration |
| 4.6 Visualizations | Maps, charts, curves | 4 days | High | 32h | react-native-maps, Victory |
| 4.7 Alert System | Banner, history, config | 2 days | Low | 16h | Notifications component |
| 4.8 Admin Module | Users, roles, audit logs | 2 days | Medium | 16h | RBAC logic |
| | | **21 days** | | **168h** | |
| **5. DevOps & Monitoring** | | | | | |
| 5.1 CI/CD | GitHub Actions workflows | 2 days | Medium | 16h | GitHub Actions, YAML |
| 5.2 Monitoring | Prometheus, Grafana | 3 days | Medium | 24h | Prometheus, Grafana |
| 5.3 Logging | ELK Stack or Loki | 3 days | Medium | 24h | Elasticsearch, Kibana |
| 5.4 Security | TLS, secrets, scanning | 2 days | Medium | 16h | Let's Encrypt, Vault |
| | | **10 days** | | **80h** | |
| **6. Tests & Documentation** | | | | | |
| 6.1 Backend Tests | pytest, integration, performance | 4 days | Medium | 32h | pytest, locust |
| 6.2 Frontend Tests | Jest, RTL, Detox E2E | 4 days | Medium | 32h | Jest, Detox |
| 6.3 Documentation | README, API docs, guides | 2 days | Low | 16h | Markdown, OpenAPI |
| | | **10 days** | | **80h** | |
| **TOTAL PROJECT** | | **90 days** | | **720h** | |

#### 6.6.1 Distribution by Complexity

| Complexity Level | Number of Tasks | % of Project | Total Effort |
|---------------------|------------------|-------------|---------------|
| **Low** | 10 tasks | 22% | 160h |
| **Medium** | 18 tasks | 42% | 304h |
| **High** | 6 tasks | 36% | 256h |
| **TOTAL** | 34 tasks | 100% | 720h |

#### 6.6.2 Workload Calculation (1 person)

```
Assumptions:
- 1 person (individual PFE work)
- 8 productive hours per day
- 5 days per week = 40h per week
- Safety margin: +20% (unforeseen work, bugs, learning)

Calculation:
- 720h base
- +20% (144h) = 864h total
- 864h / 40h per week = 21.6 weeks ~ 5 months
- Or 108 working days (~22 calendar weeks)
```

#### 6.6.3 Possible Optimizations

| Optimization | Time Gain | Comment |
|--------------|-----------|-------------|
| Use Azure templates | -2 days | Preconfigured ARM templates |
| MongoDB Atlas (managed) | -1 day | Avoids manual installation |
| UI components library | -3 days | Prebuilt UI components |
| Swagger auto-docs | -1 day | Generated by FastAPI |
| Docker Compose dev | -1 day | Simplified local dev |
| **Total possible gain** | **-8 days** | **Reduced to 82 days** |

#### 6.6.4 Critical Points (Time Risks)

 **Tasks to watch** (likely to slip):

1. **2.2 Ingestion Service** (40h): MQTT complexity + validation + routing
2. **2.4 Analytics Service** (48h): Complex DTC business logic
3. **3.3 TimescaleDB** (32h): Learning curve if new
4. **4.6 Visualizations** (32h): Maps + charts integration is delicate
5. **1.3 Kubernetes** (32h): Complex orchestration for beginners

**Recommendation**: Plan a **+30% buffer** on these tasks.


### 7. Team Size and Project Type

- **Team size**: 1 person (individual work)
- **Project type**: academic PFE project with high technical complexity
- **Goal**: deliver a functional, documented MVP with a clear and scalable architecture
---

## Project Architecture

### 1. General Architecture (7 Layers)

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1 - DEVICES (OBD Dongles)                                │
│  ├─ DTC Codes, Telemetry                                       │
│  └─ MQTT/HTTP to Ingestion Service                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 2 - INGESTION & VALIDATION                               │
│  ├─ MQTT Broker (Eclipse Mosquitto)                             │
│  ├─ Validation and Deduplication                                │
│  ├─ Smart Router (SQL/NoSQL/TimeSeries decision)                │
│  └─ Message Queue (RabbitMQ for async tasks)                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 3 - STORAGE (Hybrid)                                     │
│  ├─ PostgreSQL (vehicles, users, alerts, events)                │
│  ├─ MongoDB (DTC codes, raw payloads)                           │
│  ├─ TimescaleDB/InfluxDB (telemetry time-series)                │
│  └─ Redis (cache, real-time subscriptions)                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 4 - SERVICES (Microservices)                             │
│  ├─ Ingestion Service (MQTT listener, validation)               │
│  ├─ API Service (REST endpoints, authentication)                │
│  ├─ Analytics Service (diagnostic analysis, alerts)             │
│  ├─ Notification Service (push, email, SMS)                     │
│  └─ WebSocket Service (real-time app updates)                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 5 - API & REAL-TIME                                      │
│  ├─ REST API (FastAPI - documented OpenAPI/Swagger)             │
│  ├─ WebSocket Server (live updates, subscriptions)              │
│  └─ Authentication (JWT tokens, OAuth2)                         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 6 - CLIENT APPLICATIONS                                  │
│  ├─ Mobile App (React Native + react-native-maps + Victory)     │
│  ├─ Admin Panel (user management, reports)                      │
│  └─ Web Dashboard (managed by another team - optional)          │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 7 - OPERATIONS & MONITORING                              │
│  ├─ Prometheus + Grafana (metrics, dashboards)                  │
│  ├─ ELK Stack (logs aggregation)                                │
│  ├─ GitHub Actions (CI/CD)                                      │
│  └─ Terraform (Infrastructure as Code)                          │
└──────────────────────────────────────────────────────────────────┘
```

### 2. Detailed Technical Components

#### 2.1 Backend (FastAPI)

```
Backend (Python FastAPI)
├── Services
│   ├── IngestionService
│   │   ├── MQTT listener
│   │   ├── Validation (Pydantic schemas)
│   │   ├── Deduplication (Redis cache)
│   │   └── Router (-> SQL/NoSQL/TimeSeries)
│   │
│   ├── APIService
│   │   ├── REST Endpoints (/api/v1/*)
│   │   ├── JWT Authentication
│   │   ├── Role-Based Access Control (RBAC)
│   │   └── OpenAPI documentation
│   │
│   └── AnalyticsService
│       ├── Real-time anomaly detection
│       ├── DTC code analysis
│       ├── Alert generation
│       └── Recommendation engine
│
├── Models (Pydantic)
│   ├── Vehicle, Fleet, User schemas
│   ├── DTC, Telemetry
│   └── Alert, Maintenance schemas
│
├── Database Access Layer
│   ├── PostgreSQL ORM (SQLAlchemy)
│   ├── MongoDB client
│   └── TimescaleDB queries
│
├── Utils
│   ├── Auth helpers (JWT, RBAC)
│   ├── Validators, parsers
│   └── Logger, error handlers
│
└── Configuration
    ├── Environment variables
    ├── Database connections
    └── MQTT broker settings
```

#### 2.2 Storage (Hybrid)

| Database | Usage | Data | Queries |
|------|-------|---------|----------|
| **PostgreSQL** | Relational data | Vehicles, Users, Fleets, Alerts, Events | ACID, JOIN, indexes |
| **MongoDB** | Document storage | DTC codes, raw payloads, configurations | Flexible schema |
| **TimescaleDB** | Time-series | Telemetry, GPS, temperature, RPM history | Time-group, aggregation |
| **Redis** | Cache and PubSub | Session cache, real-time subscriptions | Key-value, Pub/Sub |

##### 2.2.1 API Request/Response Examples

**Example 1: Get vehicles of a fleet**
```http
GET /api/v1/fleets/fleet-123/vehicles
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```json
{
  "success": true,
  "data": [
    {
      "id": "veh-001",
      "vin": "1HGBH41JXMN109186",
      "make": "Toyota",
      "model": "Corolla",
      "year": 2022,
      "license_plate": "ABC-1234",
      "status": "online",
      "last_seen": "2026-02-06T10:30:00Z",
      "location": {
        "lat": 36.8065,
        "lng": 10.1815
      },
      "active_dtc_count": 2,
      "odometer_km": 45230
    },
    {
      "id": "veh-002",
      "vin": "2HGFG12859H543211",
      "make": "Renault",
      "model": "Megane",
      "year": 2021,
      "license_plate": "TUN-5678",
      "status": "offline",
      "last_seen": "2026-02-05T18:45:00Z",
      "location": null,
      "active_dtc_count": 0,
      "odometer_km": 32100
    }
  ],
  "count": 2
}
```

**Example 2: Get DTC codes of a vehicle**
```http
GET /api/v1/dtc/veh-001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```json
{
  "success": true,
  "vehicle_id": "veh-001",
  "dtc_codes": [
    {
      "id": "dtc-12345",
      "code": "P0420",
      "description": "Catalyst System Efficiency Below Threshold (Bank 1)",
      "severity": "warning",
      "status": "active",
      "first_detected": "2026-02-03T14:20:00Z",
      "last_occurrence": "2026-02-06T09:15:00Z",
      "occurrence_count": 8,
      "recommended_action": "Check catalytic converter, possible replacement"
    },
    {
      "id": "dtc-12346",
      "code": "P0171",
      "description": "System Too Lean (Bank 1)",
      "severity": "critical",
      "status": "active",
      "first_detected": "2026-02-06T08:30:00Z",
      "last_occurrence": "2026-02-06T10:25:00Z",
      "occurrence_count": 3,
      "recommended_action": "Check fuel injection, MAF sensor, and air leaks"
    }
  ],
  "count": 2
}
```

**Example 3: Login and get JWT**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "manager@mallouliauto.com",
  "password": "SecurePass123!"
}
```
```json
{
  "success": true,
  "user": {
    "id": "user-456",
    "email": "manager@mallouliauto.com",
    "name": "Ahmed Ben Ali",
    "role": "manager",
    "fleet_ids": ["fleet-123"]
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlci00NTYiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTY0MTA5ODQwMH0.xyz",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlci00NTYiLCJ0eXBlIjoicmVmcmVzaCIsImV4cCI6MTY0MTcwMzIwMH0.abc",
    "expires_in": 900,
    "token_type": "Bearer"
  }
}
```

**Example 4: Get telemetry history**
```http
GET /api/v1/telemetry/veh-001?start=2026-02-05T00:00:00Z&end=2026-02-06T00:00:00Z&metrics=engine_temp,speed
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```json
{
  "success": true,
  "vehicle_id": "veh-001",
  "metrics": {
    "engine_temp": [
      {"timestamp": "2026-02-05T08:00:00Z", "value": 85.5},
      {"timestamp": "2026-02-05T08:05:00Z", "value": 88.2},
      {"timestamp": "2026-02-05T08:10:00Z", "value": 90.1}
    ],
    "speed": [
      {"timestamp": "2026-02-05T08:00:00Z", "value": 65},
      {"timestamp": "2026-02-05T08:05:00Z", "value": 72},
      {"timestamp": "2026-02-05T08:10:00Z", "value": 68}
    ]
  },
  "count": 3
}
```

#### 2.3 Mobile App (React Native)

```
Mobile App (React Native + TypeScript)
├── Pages
│   ├── Dashboard (home, KPI overview)
│   ├── Fleet Map (react-native-maps with vehicle markers)
│   ├── Vehicles (list, details, history)
│   ├── Diagnostics (DTC codes, alerts)
│   ├── Maintenance (schedule, recommendations)
│   └── Admin (users, settings)
│
├── Components
│   ├── Map (react-native-maps integration)
│   ├── Charts (Victory Native / react-native-svg)
│   ├── Tables (sortable, filterable)
│   ├── Alerts (notification display)
│   └── Forms (vehicle/user management)
│
├── State Management
│   ├── Zustand (global state)
│   ├── TanStack Query (server state)
│   └── WebSocket listener
│
├── Styling
│   └── NativeWind + custom theme
│
└── HTTP Client
    ├── Axios with interceptors
    ├── JWT token management
    └── Error handling
```

### 3. Complete Data Flow

```
1. OBD DONGLE -> DATA INGESTION
  Dongle sends: { vehicle_id, dtc_codes, gps, telemetry, timestamp }
         ↓ (MQTT pub "dongle/ABC123/telemetry")
   
2. MQTT BROKER
  Mosquitto receives and distributes to listeners
         ↓
   
3. INGESTION SERVICE
  ├─ Validate (schema, vehicle ownership)
  ├─ Deduplicate (check Redis cache last 5 min)
  ├─ Decide route:
  │  ├─ DTC codes -> MongoDB
  │  ├─ Telemetry (temp, RPM) -> TimescaleDB
  │  ├─ Status -> PostgreSQL
  │  └─ Enrich (reverse geocoding) -> Redis queue
  └─ Send acknowledgment to dongle
         ↓
   
4. STORAGE
  PostgreSQL: INSERT vehicle status, location
   MongoDB: UPSERT DTC codes with timestamp
   TimescaleDB: INSERT telemetry points
   Redis: Cache last position, subscribe updates
         ↓
   
5. ANALYTICS SERVICE (async via RabbitMQ)
  ├─ Detect anomalies (temp > 110C -> CRITICAL alert)
   ├─ Analyze DTC patterns (recurring codes)
   └─ Generate maintenance tasks
         ↓
   
6. ALERTS AND NOTIFICATIONS
   ├─ Create alert in PostgreSQL
   ├─ Publish to Redis /alerts/{vehicle_id}
  └─ Send WebSocket message to mobile app
         ↓
   
7. REST API AND WEBSOCKET
  API client requests: GET /api/v1/vehicles/{id}/status
   WebSocket subscriptions: ws://api/vehicles/{fleet_id}
         ↓
   
8. MOBILE APP
  ├─ Fetch data via REST API
  ├─ Subscribe WebSocket for real-time updates
  ├─ Render map (react-native-maps) with vehicle positions
  ├─ Display charts (Victory)
  └─ Show alerts and recommendations
```

### 4. Communication Protocols

| Protocol | Usage | Direction | Advantages |
|-----------|-------|-----------|-----------|
| **MQTT** | Dongle <-> Backend | Upstream | Lightweight, reliable, offline-ready |
| **HTTP** | Dongle fallback | Upstream | Simple, firewall-friendly |
| **REST API** | Client <-> Backend | Bidirectional | Stateless, RESTful, OpenAPI |
| **WebSocket** | Real-time updates | Downstream | Low latency, push updates |


### 5. Security and Authentication

```
┌─ DONGLE AUTHENTICATION
│  ├─ Device ID + Secret Key
│  ├─ MQTT over TLS (port 8883)
│  └─ Validation before storage
│
├─ USER AUTHENTICATION
│  ├─ Username/Password -> JWT token
│  ├─ Token includes: user_id, roles, fleet_id
│  ├─ Refresh token (7 days expiry)
│  └─ All API endpoints require Authorization header
│
├─ DATA ENCRYPTION
│  ├─ TLS 1.3 for all communications
│  ├─ PostgreSQL: pgcrypto encryption for sensitive fields
│  ├─ MongoDB: field-level encryption
│  └─ Redis: AUTH password required
│
└─ AUDIT AND COMPLIANCE
  ├─ Log all data access (PostgreSQL audit table)
  ├─ GDPR: anonymization for deleted users
  └─ Rate limiting: 100 requests/min per user
```

### 6. Deployment (Infrastructure)

```
 Azure Cloud
├── Load Balancer (distributes traffic)
├── Container Registry (Docker images)
│
├── Kubernetes Cluster (orchestration)
│   ├── Ingestion Service Pod(s) (1-3 replicas)
│   ├── API Service Pod(s) (2-5 replicas)
│   ├── Analytics Service Pod(s) (1-2 replicas)
│   └── WebSocket Pod(s) (1-2 replicas)
│
├── Databases
│   ├── PostgreSQL (RDS managed)
│   ├── MongoDB Atlas (managed cluster)
│   ├── TimescaleDB (PostgreSQL extension)
│   └── Redis (ElastiCache managed)
│
├── Message Queue
│   └── RabbitMQ (AWS MQ or self-hosted)
│
└── Monitoring
    ├── Prometheus (metrics collection)
    ├── Grafana (visualization)
    ├── ELK Stack (logs)
    └── CloudWatch (AWS logs)
```

### 7. Technology Stack Summary

| Layer | Technology | Version |
|--------|------------|---------|
| **Backend** | Python + FastAPI | 3.11 + 0.104+ |
| **API Docs** | OpenAPI/Swagger | 3.0 |
| **Database (SQL)** | PostgreSQL + TimescaleDB | 15 + 2.13 |
| **Database (NoSQL)** | MongoDB | 6.0+ |
| **Cache** | Redis | 7+ |
| **Message Queue** | RabbitMQ | 3.12+ |
| **MQTT** | Eclipse Mosquitto | 2.0+ |
| **Frontend** | React Native  | 0.72+ |
| **Styling** | NativeWind | 4.0+ |
| **Maps** | react-native-maps | 1.7+ |
| **Charts** | Victory Native or react-native-svg | - |
| **State Management** | Zustand | 4.4+ |
| **HTTP Client** | Axios | 1.6+ |
| **Container** | Docker | 24+ |
| **Orchestration** | Kubernetes | 1.28+ |
| **IaC** | Terraform | 1.5+ |
| **CI/CD** | GitHub Actions | - |
| **Monitoring** | Prometheus + Grafana | 2.40+ + 10+ |
| **Logging** | ELK Stack or Loki | - |

---

# PART II: IMPLEMENTATION

---

## 1. Introduction

The implementation phase is the operational core of the MALLOULIAUTO project. After defining the overall architecture and technical components in the first part, this section details the **concrete realization** of the automotive diagnostic IoT platform.

This phase covers the entire development process, from needs analysis to effective implementation of backend services, cloud infrastructure, REST APIs, the hybrid storage system, and the mobile app. The goal is to transform the architectural design into a functional, testable, and deployable solution.

Implementation is structured around several major axes:

1. **In-depth needs analysis**: Precise identification of functional and non-functional requirements, definition of actors and their interactions with the system.

2. **Detailed technical specification**: Translation of business needs into implementable technical specifications, with prioritization and acceptance criteria.

3. **Iterative development**: Establishing an Agile/Scrum process adapted to individual work, with sprints focused on concrete deliverables.

4. **Integration and testing**: Continuous validation of each component, unit tests, integration tests, and performance tests.

5. **Progressive deployment**: Staged production rollout, monitoring, and adjustments based on feedback.

This methodical approach ensures that each developed feature precisely meets identified needs, while maintaining quality, scalability, and security. The implementation follows DevOps best practices and emphasizes automation, documentation, and traceability.

---

## 2. Needs Analysis

### 2.1 Context and Problem Statement

The Tunisian fleet management market lacks solutions adapted to local constraints. Fleet managers (transport companies, insurance firms, delivery services) need **real-time visibility** into vehicle status to:

- **Reduce maintenance costs**: Anticipate failures before they occur
- **Optimize usage**: Track vehicle location and trips
- **Improve safety**: Detect risky driving behaviors
- **Ensure compliance**: Maintain regulatory tracking for vehicles

Existing commercial solutions (Verizon Connect, Geotab, Samsara) are too expensive and not adapted to the Tunisian context (unstable 3G/4G connectivity, limited purchasing power, local requirements). Open-source solutions (Traccar, OpenGTS) are limited to basic GPS tracking and do not integrate advanced OBD diagnostics.

### 2.2 System Objectives

The MALLOULIAUTO system aims to provide a **complete cloud platform** enabling:

| Objective | Description | Benefit |
|----------|-------------|----------|
| **Real-time monitoring** | Live telemetry (< 5s latency) | Instant fleet visibility |
| **Automotive diagnostics** | DTC code analysis, fault detection | Preventive maintenance, cost reduction |
| **Smart alerts** | Multi-channel notifications (Email, SMS, Push) | Faster reaction to anomalies |
| **Complete history** | Storage and analysis of past data | Trend analysis, audit |
| **Intuitive interface** | Responsive mobile app with maps and charts | Easier decision making |
| **Scalability** | Support 100 to 10,000+ vehicles | Growth without redesign |
| **Security** | Authentication, encryption, audit | Protection of sensitive data |

### 2.3 Project Scope

**Included in scope:**

✅ IoT data ingestion (MQTT, HTTP, WebSocket)  
✅ Secure REST API with JWT authentication  
✅ Hybrid storage (PostgreSQL + MongoDB + TimescaleDB)  
✅ Multi-channel notification system  
✅ Administrator mobile app (React Native)  
✅ Real-time visualizations (charts)  
✅ Alert and diagnostics management  
✅ Cloud infrastructure (Azure + Kubernetes)  
✅ CI/CD and monitoring (GitHub Actions, Prometheus, Grafana)  

**Out of scope:**

❌ End-user mobile app (handled by another team member)  
❌ Predictive Machine Learning models (handled by data scientist)  
❌ OBD dongle hardware (provided by a third-party partner)  
❌ Third-party ERP/CRM integration  
❌ Advanced billing module  

---

## 3. Actor Identification

### 3.1 Actor Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  MALLOULIAUTO SYSTEM                        │
│                                                             │
│  ┌─────────────┐                         ┌─────────────┐   │
│  │   HUMANS    │                         │  SYSTEMS   │   │
│  └─────────────┘                         └─────────────┘   │
│                                                             │
│  👤 Fleet Manager                 🔌 OBD Dongle            │
│  👤 Driver                         🔌 MQTT Broker          │
│  👤 System Administrator          🔌 External Services     │
│  👤 Maintenance Analyst           🔌 Third-Party APIs      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Actor Description

#### 3.2.1 Human Actors

| Actor | Role | Objectives | Main Interactions |
|--------|------|-----------|-------------------------|
| **Fleet Manager** | Oversees the entire fleet | Optimize costs, reduce failures, track vehicles | Mobile app dashboard, alerts, reports |
| **Driver** | Drives the vehicles | Be informed of critical alerts | Push notifications (mobile - out of scope) |
| **System Administrator** | Manages platform and users | Configure system, manage access, monitoring | Admin panel, user management, logs |
| **Maintenance Analyst** | Analyzes trends and optimizes maintenance | Identify failure patterns | Analytics reports, data exports |

#### 3.2.2 System Actors

| System Actor | Role | Data Provided/Consumed |
|----------------|------|----------------------------|
| **OBD Dongle** | Collects vehicle data | Sends: DTC, telemetry (temp, RPM, fuel) |
| **MQTT Broker** | IoT message orchestration | Receives dongle messages, distributes to services |
| **Cloud Services** | Hosting infrastructure | AWS/Azure: compute, storage, networking |
| **External Services** | Third-party integrations | SMS (Twilio), Email (SMTP), Geocoding (OpenStreetMap) |
| **Alert System** | Anomaly detection | Generates alerts based on business rules |

### 3.3 Use Cases by Actor

#### Fleet Manager

1. **View real-time vehicle positions** on interactive map
2. **Receive critical alerts** (engine overheating, geofence exit, excessive speed)
3. **Visualize health status** of each vehicle (active DTC codes)
4. **Plan maintenance** based on system recommendations
5. **Manage alert configuration** (thresholds, recipients, channels)

#### System Administrator

1. **Manage user accounts** (create, update, deactivate)
2. **Configure role-based permissions** (RBAC)
3. **Associate dongles to vehicles** (time-bound assignment)
4. **Monitor system health** (Grafana dashboards)
5. **Review audit logs** for compliance
6. **Configure global alert rules**

---

## 4. Requirements Specification

### 4.1 Functional Requirements

Functional requirements describe **what the system must do** from the user perspective.

#### 4.1.1 Vehicle Management

| ID | Requirement | Priority | Description |
|----|------------|----------|-------------|
| **BF-V01** | Register a vehicle | 🔴 HIGH | Create a vehicle record with make, model, VIN, plate, year |
| **BF-V02** | Update vehicle information | 🟠 MEDIUM | Update data for an existing vehicle |
| **BF-V03** | Delete a vehicle | 🟡 LOW | Deactivate a vehicle (soft delete) |
| **BF-V04** | Associate dongle to vehicle | 🔴 HIGH | Link an OBD dongle to a vehicle with timestamp |
| **BF-V05** | Transfer dongle between vehicles | 🟠 MEDIUM | Reassign a dongle while preserving history |
| **BF-V06** | View vehicle record | 🔴 HIGH | View full details: info, current status, history |

#### 4.1.2 Data Ingestion and Storage

| ID | Requirement | Priority | Description |
|----|------------|----------|-------------|
| **BF-I01** | Receive MQTT data | 🔴 HIGH | Listen to MQTT messages from dongles (GPS, DTC, telemetry) |
| **BF-I02** | Validate incoming payloads | 🔴 HIGH | Check schema, format, and data integrity |
| **BF-I03** | Data deduplication | 🟠 MEDIUM | Avoid duplicates (messages received multiple times) |
| **BF-I04** | Route data by type | 🔴 HIGH | SQL (vehicles), NoSQL (DTC), TimeSeries (telemetry) |
| **BF-I06** | Store DTC codes | 🔴 HIGH | Store fault codes with metadata in MongoDB |
| **BF-I07** | Store telemetry | 🔴 HIGH | Time-series data (temp, RPM, fuel) in TimescaleDB |
| **BF-I08** | Smart retention | 🟠 MEDIUM | Hot (7d), Warm (30d), Cold (1y+) with archiving |

#### 4.1.3 Diagnostics and Alerts

| ID | Requirement | Priority | Description |
|----|------------|----------|-------------|
| **BF-D01** | Analyze DTC codes | 🔴 HIGH | Decode codes, determine severity (INFO, WARNING, CRITICAL) |
| **BF-D02** | Detect real-time anomalies | 🔴 HIGH | Overheating (>110C), low battery (<11.5V), critical fuel (<15%) |
| **BF-D03** | Generate automatic alerts | 🔴 HIGH | Create alerts in the database based on configured rules |
| **BF-D04** | Notify by email | 🔴 HIGH | Send email to configured recipients |
| **BF-D05** | Notify by SMS | 🟠 MEDIUM | Send SMS via Twilio for CRITICAL alerts |
| **BF-D06** | Notify by WebSocket | 🔴 HIGH | Real-time push notification to the mobile app |
| **BF-D07** | Configure alert thresholds | 🟠 MEDIUM | Allow per-vehicle threshold customization |
| **BF-D08** | Alert history | 🔴 HIGH | View all past alerts with status |
| **BF-D09** | Acknowledge alert | 🔴 HIGH | Mark alert as "seen" with user_id and timestamp |
| **BF-D10** | Detect recurring DTCs | 🟠 MEDIUM | Identify codes recurring 3x in 7 days |

#### 4.1.4 Mobile App

| ID | Requirement | Priority | Description |
|----|------------|----------|-------------|
| **BF-DW02** | Vehicle list with status | 🔴 HIGH | Filterable/sortable list of vehicles and health status |
| **BF-DW03** | Telemetry charts | 🔴 HIGH | Temperature, RPM, fuel curves over selectable ranges |
| **BF-DW04** | KPI dashboard | 🟠 MEDIUM | Widgets: active alerts, healthy vehicles, maintenance costs |
| **BF-DW05** | Vehicle details | 🔴 HIGH | Page with info, position, active DTCs, history |
| **BF-DW06** | Trip history | 🟠 MEDIUM | Replay past trips on map with timeline |
| **BF-DW08** | In-app notifications | 🔴 HIGH | Real-time alert banner with "Acknowledge" button |
| **BF-DW09** | Search and filters | 🟠 MEDIUM | Filter vehicles by status, fleet, active alert |

#### 4.1.5 Authentication and Authorization

| ID | Requirement | Priority | Description |
|----|------------|----------|-------------|
| **BF-A01** | User login | 🔴 HIGH | Login with email/password, generate JWT |
| **BF-A02** | JWT token management | 🔴 HIGH | Access token (1h) + refresh token (7d) |
| **BF-A03** | User roles | 🔴 HIGH | Admin, Manager, Maintenance Analyst, Read-only |
| **BF-A04** | Role-based permissions (RBAC) | 🔴 HIGH | Restrict API endpoints by role |
| **BF-A05** | Logout | 🟠 MEDIUM | Server-side token invalidation (Redis blacklist) |
| **BF-A06** | User management (admin) | 🟠 MEDIUM | User CRUD, role assignment |
| **BF-A07** | Login audit | 🟡 LOW | Log all logins (IP, timestamp, success/failure) |

#### 4.1.6 REST API

| ID | Requirement | Priority | Description |
|----|------------|----------|-------------|
| **BF-API01** | Vehicle endpoints | 🔴 HIGH | GET, POST, PUT, DELETE /api/v1/vehicles |
| **BF-API02** | Alert endpoints | 🔴 HIGH | GET /api/v1/alerts, PUT /alerts/{id}/acknowledge |
| **BF-API03** | Telemetry endpoints | 🔴 HIGH | GET /api/v1/vehicles/{id}/telemetry?start&end |
| **BF-API04** | Diagnostic endpoints | 🔴 HIGH | GET /api/v1/vehicles/{id}/dtc |
| **BF-API05** | OpenAPI documentation | 🟠 MEDIUM | Auto-generated Swagger UI with examples |
| **BF-API06** | Pagination | 🟠 MEDIUM | Support ?page=1&limit=50 for lists |
| **BF-API07** | Rate limiting | 🟠 MEDIUM | Max 100 requests/min per user |
| **BF-API08** | Schema validation | 🔴 HIGH | Pydantic schemas for all inputs |

### 4.2 Non-Functional Requirements

Non-functional requirements describe **how the system must operate** (quality, performance, security).

#### 4.2.1 Performance

| ID | Requirement | Criteria | Priority |
|----|-------------|----------|----------|
| **BNF-P01** | Ingestion latency | < 5 seconds from dongle to storage | 🔴 HIGH |
| **BNF-P02** | API response time | < 500ms for 95% of requests | 🔴 HIGH |
| **BNF-P03** | WebSocket latency | < 2 seconds for push notifications | 🔴 HIGH |
| **BNF-P04** | Ingestion throughput | 1000+ messages/second per service | 🟠 MEDIUM |
| **BNF-P05** | App load time | < 3 seconds (First Contentful Paint) | 🟠 MEDIUM |
| **BNF-P06** | Database queries | < 200ms for 90% of queries | 🟠 MEDIUM |

#### 4.2.2 Scalability

| ID | Requirement | Criteria | Priority |
|----|-------------|----------|----------|
| **BNF-S01** | Vehicle support | 100 vehicles phase 1 -> 10,000+ phase 2 | 🔴 HIGH |
| **BNF-S02** | Horizontal scaling | Kubernetes pod auto-scaling based on load | 🔴 HIGH |
| **BNF-S03** | Data partitioning | Tables partitioned by date (TimescaleDB) | 🟠 MEDIUM |
| **BNF-S04** | Load balancing | Traffic distribution across replicas | 🔴 HIGH |

#### 4.2.3 Availability

| ID | Requirement | Criteria | Priority |
|----|-------------|----------|----------|
| **BNF-D01** | System uptime | 99.5% minimum (SLA) | 🔴 HIGH |
| **BNF-D02** | Fault tolerance | Service continues if 1 pod fails | 🔴 HIGH |
| **BNF-D03** | Automatic backup | Daily DB snapshots, tested monthly | 🔴 HIGH |
| **BNF-D04** | Recovery Time Objective (RTO) | < 1 hour in case of major outage | 🟠 MEDIUM |
| **BNF-D05** | Recovery Point Objective (RPO) | Max 5 minutes data loss | 🟠 MEDIUM |

#### 4.2.4 Security

| ID | Requirement | Criteria | Priority |
|----|-------------|----------|----------|
| **BNF-SEC01** | Encryption in transit | TLS 1.3 for all connections | 🔴 HIGH |
| **BNF-SEC02** | Encryption at rest | PostgreSQL pgcrypto, MongoDB field-level encryption | 🔴 HIGH |
| **BNF-SEC03** | Dongle authentication | Device ID + secret key for MQTT | 🔴 HIGH |
| **BNF-SEC04** | User authentication | JWT with refresh tokens | 🔴 HIGH |
| **BNF-SEC05** | RBAC authorization | Role-based access to all endpoints | 🔴 HIGH |
| **BNF-SEC06** | Audit logging | Log all sensitive actions (PostgreSQL) | 🟠 MEDIUM |
| **BNF-SEC07** | Injection protection | Parameterized queries, input validation | 🔴 HIGH |
| **BNF-SEC08** | Rate limiting | Anti-DDoS, max requests/min | 🟠 MEDIUM |

#### 4.2.5 Maintainability

| ID | Requirement | Criteria | Priority |
|----|-------------|----------|----------|
| **BNF-M01** | Code quality | Lint (pylint, eslint), formatters (black, prettier) | 🟠 MEDIUM |
| **BNF-M02** | Unit tests | Coverage > 70% for backend critical paths | 🟠 MEDIUM |
| **BNF-M03** | Code documentation | Python docstrings, JSDoc for key functions | 🟠 MEDIUM |
| **BNF-M04** | API documentation | OpenAPI/Swagger with examples and descriptions | 🔴 HIGH |
| **BNF-M05** | Structured logs | JSON logs with correlation IDs | 🟠 MEDIUM |
| **BNF-M06** | Monitoring | Prometheus metrics + Grafana dashboards | 🔴 HIGH |

#### 4.2.6 Compatibility

| ID | Requirement | Criteria | Priority |
|----|-------------|----------|----------|
| **BNF-C01** | Web browsers | Chrome, Firefox, Safari, Edge (latest 2 versions) | 🔴 HIGH |
| **BNF-C02** | Responsive design | Support desktop (1920px), tablet (768px), mobile (375px) | 🔴 HIGH |
| **BNF-C03** | IoT protocols | MQTT 3.1.1, HTTP/1.1, WebSocket RFC 6455 | 🔴 HIGH |

#### 4.2.7 Compliance

| ID | Requirement | Criteria | Priority |
|----|-------------|----------|----------|
| **BNF-CF01** | GDPR | Anonymize data for deleted users | 🟠 MEDIUM |
| **BNF-CF02** | Data retention | Clear retention/deletion policy | 🟡 LOW |
| **BNF-CF03** | Audit trail | Full traceability for audits | 🟠 MEDIUM |

---

---

## 5. Project Management

### 5.1 Product Backlog

The Product Backlog lists all features to be developed, ordered by priority and ready to be integrated into sprints.

#### 5.1.1 Product Backlog - Ingestion and API

| ID | Feature | User Story | Priority | Sprint |
|----|---------|-----------|----------|--------|
| **PB-001** | MQTT Broker connection | As a backend service, I want to connect to the MQTT broker to receive dongle data | 🔴 HIGH | Sprint 1 |
| **PB-002** | MQTT payload validation | As the system, I want to validate all received payloads to reject malformed data | 🔴 HIGH | Sprint 1 |
| **PB-003** | Message deduplication | As the system, I want to avoid duplicate messages received multiple times | 🟠 MEDIUM | Sprint 1 |
| **PB-004** | Smart data routing | As the system, I want to route data automatically to PostgreSQL, MongoDB, or TimescaleDB based on type | 🔴 HIGH | Sprint 1 |
| **PB-005** | JWT API authentication | As a client, I want to log in with email/password and receive a valid JWT | 🔴 HIGH | Sprint 1 |
| **PB-006** | Refresh tokens | As an authenticated client, I want to renew my JWT without re-login | 🟠 MEDIUM | Sprint 1 |
| **PB-007** | RBAC (Role-Based Access) | As an admin, I want to control API access based on user roles | 🔴 HIGH | Sprint 1 |
| **PB-008** | Vehicle CRUD endpoints | As a manager, I want to list, create, update, and delete vehicles via API | 🔴 HIGH | Sprint 2 |
| **PB-009** | Alert endpoints | As a manager, I want to view and acknowledge alerts via API | 🔴 HIGH | Sprint 2 |
| **PB-010** | Telemetry endpoints | As a manager, I want to access vehicle telemetry for a given period | 🔴 HIGH | Sprint 2 |
| **PB-011** | DTC diagnostic endpoints | As a manager, I want to view active and historical DTC codes for a vehicle | 🔴 HIGH | Sprint 2 |
| **PB-012** | OpenAPI documentation | As a developer, I want complete API documentation with request examples | 🟠 MEDIUM | Sprint 2 |

#### 5.1.2 Product Backlog - Storage and Databases

| ID | Feature | User Story | Priority | Sprint |
|----|---------|-----------|----------|--------|
| **PB-013** | PostgreSQL schema | As a DBA, I want to create tables for vehicles, users, alerts, assignments | 🔴 HIGH | Sprint 1 |
| **PB-014** | MongoDB DTC schema | As the system, I want to store DTC codes with history in MongoDB | 🔴 HIGH | Sprint 1 |
| **PB-015** | TimescaleDB schema | As the system, I want to store telemetry time-series with date partitioning | 🔴 HIGH | Sprint 1 |
| **PB-016** | Redis configuration | As the system, I want to cache frequently accessed data (last position, session) | 🟠 MEDIUM | Sprint 2 |
| **PB-017** | DB migrations | As a DBA, I want to manage schema versions and data migrations | 🟠 MEDIUM | Sprint 1 |
| **PB-018** | Optimized indexes | As a DBA, I want to create indexes to accelerate frequent queries | 🟠 MEDIUM | Sprint 3 |
| **PB-019** | Data archiving | As the system, I want to archive old data (> 1 year) to cold storage | 🟡 LOW | Sprint 4 |

#### 5.1.3 Product Backlog - Vehicle and Dongle Management

| ID | Feature | User Story | Priority | Sprint |
|----|---------|-----------|----------|--------|
| **PB-020** | Register vehicle | As a manager, I want to create a vehicle record with make, model, VIN, plate | 🔴 HIGH | Sprint 2 |
| **PB-021** | Update vehicle | As a manager, I want to update vehicle information | 🟠 MEDIUM | Sprint 2 |
| **PB-022** | Delete vehicle | As an admin, I want to archive (soft delete) a vehicle | 🟡 LOW | Sprint 3 |
| **PB-023** | Associate dongle | As a manager, I want to link an OBD dongle to a vehicle with timestamp | 🔴 HIGH | Sprint 2 |
| **PB-024** | Transfer dongle | As a manager, I want to transfer a dongle to another vehicle while preserving history | 🟠 MEDIUM | Sprint 2 |
| **PB-025** | Dongle history | As a manager, I want to see the full history of dongles used by a vehicle | 🟠 MEDIUM | Sprint 3 |
| **PB-026** | View vehicle record | As a manager, I want to see full vehicle details (info, status, active DTCs, history) | 🔴 HIGH | Sprint 2 |

#### 5.1.4 Product Backlog - Diagnostics and Alerts

| ID | Feature | User Story | Priority | Sprint |
|----|---------|-----------|----------|--------|
| **PB-027** | Analyze DTC codes | As the system, I want to decode DTC codes and determine severity (INFO, WARNING, CRITICAL) | 🔴 HIGH | Sprint 2 |
| **PB-028** | Detect anomalies | As the system, I want to analyze telemetry in real time to detect overheating, low battery, critical fuel | 🔴 HIGH | Sprint 2 |
| **PB-029** | Generate alerts | As the system, I want to create an alert in the database when an anomaly is detected | 🔴 HIGH | Sprint 2 |
| **PB-030** | Notify by email | As the system, I want to send an email to configured recipients when an alert is generated | 🔴 HIGH | Sprint 3 |
| **PB-031** | Notify by SMS | As the system, I want to send an SMS (Twilio) for critical alerts | 🟠 MEDIUM | Sprint 3 |
| **PB-032** | Notify by WebSocket | As the app, I want to receive real-time alerts via WebSocket | 🔴 HIGH | Sprint 3 |
| **PB-033** | Configure thresholds | As a manager, I want to customize alert thresholds per vehicle | 🟠 MEDIUM | Sprint 3 |
| **PB-034** | Alert history | As a manager, I want to view all past alerts with status (pending, acknowledged, resolved) | 🔴 HIGH | Sprint 3 |
| **PB-035** | Acknowledge alert | As a manager, I want to mark an alert as "seen" (acknowledge) | 🔴 HIGH | Sprint 3 |
| **PB-036** | Detect recurring DTCs | As the system, I want to detect when the same DTC appears 3 times in 7 days | 🟠 MEDIUM | Sprint 4 |

#### 5.1.5 Product Backlog - Mobile App

| ID | Feature | User Story | Priority | Sprint |
|----|---------|-----------|----------|--------|
| **PB-037** | Interactive GPS map | As a manager, I want to see vehicle positions on a real-time map | 🔴 HIGH | Sprint 3 |
| **PB-038** | Status-colored markers | As a manager, I want vehicles color-coded (green=healthy, orange=alert, red=critical) | 🔴 HIGH | Sprint 3 |
| **PB-039** | Vehicle list table | As a manager, I want a filterable/sortable table of vehicles with status | 🔴 HIGH | Sprint 3 |
| **PB-040** | KPI dashboard | As a manager, I want KPIs (active alerts, healthy vehicles, maintenance costs) | 🟠 MEDIUM | Sprint 3 |
| **PB-041** | In-app notifications | As a manager, I want a banner with an "Acknowledge" button | 🔴 HIGH | Sprint 3 |
| **PB-042** | Telemetry charts | As a manager, I want temperature, RPM, fuel curves over 24h/7d/30d | 🔴 HIGH | Sprint 4 |
| **PB-043** | Vehicle details | As a manager, I want a detailed vehicle page with info, DTCs, history | 🔴 HIGH | Sprint 3 |
| **PB-044** | Trip history | As a manager, I want to replay past trips on the map | 🟠 MEDIUM | Sprint 4 |
| **PB-045** | User management | As an admin, I want to create/update/delete users and assign roles | 🟠 MEDIUM | Sprint 4 |
| **PB-046** | CSV/PDF reports | As a manager, I want to export data to CSV/PDF | 🟡 LOW | Sprint 4 |
| **PB-047** | Global search | As a manager, I want to search vehicles by VIN, plate, dongle ID | 🟠 MEDIUM | Sprint 4 |

#### 5.1.6 Product Backlog - Infrastructure and DevOps

| ID | Feature | User Story | Priority | Sprint |
|----|---------|-----------|----------|--------|
| **PB-048** | Set up Azure | As an infra engineer, I want to configure cloud infrastructure with VPC, subnets, load balancer | 🔴 HIGH | Sprint 1 |
| **PB-049** | Dockerize services | As a DevOps engineer, I want to create Docker images for each microservice | 🔴 HIGH | Sprint 1 |
| **PB-050** | Kubernetes deployment | As a DevOps engineer, I want to deploy services on Kubernetes with auto-scaling | 🔴 HIGH | Sprint 2 |
| **PB-051** | CI/CD pipeline | As a DevOps engineer, I want to configure GitHub Actions to build, test, and deploy automatically | 🔴 HIGH | Sprint 2 |
| **PB-052** | Prometheus monitoring | As an infra engineer, I want to collect metrics (CPU, memory, API latency) | 🟠 MEDIUM | Sprint 2 |
| **PB-053** | Grafana dashboards | As an infra engineer, I want to visualize metrics in Grafana | 🟠 MEDIUM | Sprint 2 |
| **PB-054** | ELK Stack logging | As an infra engineer, I want to centralize logs in ELK for debug and audit | 🟠 MEDIUM | Sprint 3 |
| **PB-055** | Terraform IaC | As a DevOps engineer, I want to define all infrastructure in Terraform | 🟠 MEDIUM | Sprint 3 |
| **PB-056** | Automatic backups | As a DBA, I want daily snapshots tested monthly | 🔴 HIGH | Sprint 3 |
| **PB-057** | TLS/HTTPS | As a security engineer, I want to enforce TLS 1.3 for all connections | 🔴 HIGH | Sprint 2 |

#### 5.1.7 Product Backlog - Security and Authentication

| ID | Feature | User Story | Priority | Sprint |
|----|---------|-----------|----------|--------|
| **PB-058** | MQTT dongle auth | As the system, I want to authenticate dongles via Device ID + secret key on MQTT | 🔴 HIGH | Sprint 1 |
| **PB-059** | PostgreSQL encryption | As a DBA, I want to encrypt sensitive data (GPS, personal data) | 🟠 MEDIUM | Sprint 2 |
| **PB-060** | MongoDB encryption | As a DBA, I want to apply field-level encryption to sensitive collections | 🟠 MEDIUM | Sprint 2 |
| **PB-061** | API rate limiting | As a security engineer, I want to limit to 100 requests/min per user | 🟠 MEDIUM | Sprint 3 |
| **PB-062** | Audit trail actions | As a compliance officer, I want to log all sensitive actions (data access, modifications) | 🟠 MEDIUM | Sprint 3 |
| **PB-063** | Session management | As the system, I want to invalidate expired sessions and blacklist tokens | 🟠 MEDIUM | Sprint 2 |
| **PB-064** | Input validation | As the system, I want to validate all user inputs to prevent injections | 🔴 HIGH | Sprint 1 |

---

### 5.2 Product Backlog Summary

| Category | Count | HIGH | MEDIUM | LOW |
|-----------|-------|------|--------|-----|
| **Ingestion & API** | 12 | 8 | 3 | 1 |
| **Storage & DB** | 7 | 3 | 3 | 1 |
| **Vehicle Management** | 7 | 4 | 2 | 1 |
| **Diagnostics & Alerts** | 10 | 6 | 3 | 1 |
| **Mobile App** | 11 | 7 | 3 | 1 |
| **Infrastructure & DevOps** | 10 | 5 | 5 | 0 |
| **Security & Auth** | 7 | 3 | 4 | 0 |
| **TOTAL** | **64 user stories** | **36** | **23** | **5** |


---

## 6. UML Diagrams

### 6.1 Use Case Diagram

```plantuml
@startuml UseCase_MALLOULIAUTO_Global
left to right direction

actor Manager as "👤 Fleet\nManager"
actor Admin as "👤 Admin"
actor Analyst as "👤 Maintenance\nAnalyst"
actor Dongle as "🔌 OBD Dongle"

usecase UC_GPS as "View GPS Position\nReal Time"
usecase UC_DTC as "View Fault Codes\n(DTC)"
usecase UC_Alerts as "Manage Alerts\n& Notifications"
usecase UC_Charts as "View Telemetry\nCharts"
usecase UC_Vehicles as "Manage Vehicles\n& Dongles"
usecase UC_Registration as "Register New\nVehicle"
usecase UC_Monitoring as "Monitor Fleet\nHealth"
usecase UC_Reports as "Generate Reports\nCSV/PDF"
usecase UC_Users as "Manage Users\n& Permissions"
usecase UC_Login as "Authenticate\nJWT/RBAC"
usecase UC_DTC_Validation as "Validate & Route\nDTC Data"
usecase UC_Telemetry as "Store Telemetry\nTime Series"
usecase UC_Analytics as "Analyze Trends\n& Maintenance"

Manager --> UC_GPS
Manager --> UC_DTC
Manager --> UC_Alerts
Manager --> UC_Charts
Manager --> UC_Vehicles
Manager --> UC_Registration
Manager --> UC_Monitoring
Manager --> UC_Reports
Manager --> UC_Login

Analyst --> UC_DTC
Analyst --> UC_Charts
Analyst --> UC_Analytics
Analyst --> UC_Login

Admin --> UC_Users
Admin --> UC_Monitoring
Admin --> UC_Login

Dongle --> UC_DTC_Validation
Dongle --> UC_Telemetry
@enduml
```

### 6.2 Sequence Diagram - Dongle Ingestion Pipeline

```plantuml
@startuml Sequence_Dongle_Ingestion_Pipeline
title Complete Ingestion Pipeline - OBD Dongle -> Cloud

actor Dongle as "🔌 OBD Dongle"
participant "MQTT Broker" as MQTT
participant "Ingestion\nService" as Ingestion
participant "Validation\n& Dedup" as Validation
participant "Router\nService" as Router
participant "PostgreSQL" as DB_SQL
participant "MongoDB" as DB_NoSQL
participant "TimescaleDB" as DB_TS
participant "Analytics\nService" as Analytics
participant "Alert\nEngine" as Alerts

autonumber

Dongle ->> MQTT: Publish MQTT\ntopic: vehicles/ABC123/telemetry
note over Dongle: Payload: {GPS, DTC, Temp, RPM, Fuel, Battery}

MQTT ->> Ingestion: Message received (MQTT consumer)
Ingestion ->> Validation: Validate schema and format
Validation ->> Validation: Verify dongle authentication
Validation ->> Validation: Verify payload integrity
Validation -->> Ingestion: ✅ Validation OK

Ingestion ->> Validation: Deduplicate messages
Validation ->> Validation: Hash message + timestamp check
Validation -->> Ingestion: ✅ Not duplicated

Ingestion ->> Router: Route data by type
Router ->> Router: Split GPS | DTC | Telemetry

Router ->> DB_SQL: INSERT INTO gps_positions\n(vehicle_id, lat, lng, speed, timestamp)
DB_SQL -->> Router: ✅ Position saved

Router ->> DB_NoSQL: INSERT INTO dtc_codes\n(vehicle_id, code, description, severity)
DB_NoSQL -->> Router: ✅ DTC saved

Router ->> DB_TS: INSERT INTO telemetry\n(vehicle_id, temperature, rpm, fuel, battery, ts)
DB_TS -->> Router: ✅ Telemetry stored

Analytics ->> DB_SQL: Fetch current position
Analytics ->> DB_TS: Fetch latest temp
Analytics ->> Analytics: Analyze anomalies\n(temp > 110C?)
Analytics -->> Alerts: High temperature alert!

Alerts ->> Alerts: Create alert (CRITICAL)
Alerts ->> DB_SQL: INSERT INTO alert_history\n(vehicle_id, alert_type, severity, timestamp)
DB_SQL -->> Alerts: ✅ Alert saved

Alerts ->> Alerts: Notify managers\n(Email + WebSocket)
Alerts -->> Ingestion: ✅ Pipeline complete

note over Dongle, Ingestion: Total latency: < 5 seconds

@enduml
```

### 6.3 State Transition Diagram - Vehicle

```plantuml
@startuml State_Vehicle_Lifecycle
title States and Transitions - Vehicle Lifecycle

[*] --> REGISTERED

REGISTERED : Initial state after database registration

REGISTERED --> ACTIVE : Dongle assigned + data received

ACTIVE : Vehicle operational, telemetry received

ACTIVE --> ALERTED : Anomaly detected (DTC, overheating, etc.)

ALERTED : Waiting for intervention

ALERTED --> ACTIVE : Alert acknowledged/resolved\nby manager

ACTIVE --> MAINTENANCE : Scheduled maintenance\nor major failure

MAINTENANCE : Vehicle out of service\nfor repair

MAINTENANCE --> ACTIVE : Maintenance completed\nVehicle operational

ACTIVE --> INACTIVE : Dongle removed\nor vehicle deactivated

INACTIVE : Temporarily out of service

INACTIVE --> ACTIVE : Vehicle reactivated\nDongle reassigned

ACTIVE --> ARCHIVED : End of vehicle life\nLogical deletion

INACTIVE --> ARCHIVED : End of life without reactivation

ARCHIVED : Data preserved\nVehicle logically deleted

ARCHIVED --> [*]

note right of ALERTED
  Alert possible during
  all ACTIVE states
end note

note right of MAINTENANCE
  Automatic transition
  if critical failure
end note
```

### 6.4 State Transition Diagram - Alert

```plantuml
@startuml State_Alert_Lifecycle
title States and Transitions - Alert Lifecycle

[*] --> PENDING

PENDING : Alert generated by the system\nWaiting for review

PENDING --> ACKNOWLEDGED : Manager\nreviews the alert

ACKNOWLEDGED : Alert seen and\nbeing handled

ACKNOWLEDGED --> PENDING : Recheck anomaly\nStill present

ACKNOWLEDGED --> RESOLVED : Issue resolved\nafter intervention

RESOLVED : Alert closed\nHistory preserved

RESOLVED --> [*]

note right of PENDING
  Notifications sent
  (Email, SMS, WebSocket)
end note

note right of ACKNOWLEDGED
  Acknowledgement timestamp
  recorded with user_id
end note
```

### 6.5 State Transition Diagram - Dongle Assignment

```plantuml
@startuml State_Dongle_Assignment
title States and Transitions - Dongle Assignment to Vehicle

[*] --> UNASSIGNED

UNASSIGNED : New or removed dongle\nWaiting for assignment

UNASSIGNED --> ASSIGNED : Admin assigns dongle\nto a vehicle

ASSIGNED : Dongle linked to a vehicle\nData received normally

ASSIGNED --> TRANSFER_PENDING : Transfer request\nto another vehicle

TRANSFER_PENDING : Old assignment archived\nNew one pending

TRANSFER_PENDING --> ASSIGNED : Dongle transferred\nsuccessfully

ASSIGNED --> REMOVED : Dongle physically\nremoved from vehicle

REMOVED : History preserved\nDongle awaiting reassignment

REMOVED --> UNASSIGNED : Dongle cleaned\nand reset

ASSIGNED --> FAULTY : Connection lost\n> 24 hours

FAULTY : Dongle failure\nCommunication impossible

FAULTY --> ASSIGNED : Connection restored

FAULTY --> REMOVED : Dongle irreparable\nRemoved from service

@enduml
```






