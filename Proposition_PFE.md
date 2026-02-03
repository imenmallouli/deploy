---
title: "Conception et développement d'une plateforme cloud IoT pour le diagnostic automobile intelligent"
subtitle: "Projet de Fin d'Études"
date: "2026-01-07"
---

# Proposition de Projet de Fin d'Études

## Développement d'une solution cloud de gestion de flotte intelligente 

---

## 1. Contexte du projet

Le projet s'appuie sur l'utilisation d'un dongle automobile OBD open-source capable de collecter : 

- **Codes défaut (DTC)** - Diagnostic Trouble Codes
- **Données GPS** - Géolocalisation en temps réel
- **Données véhicule** - Vitesse, RPM, température moteur, niveau batterie, consommation carburant, etc.

Le dongle est considéré comme un **équipement existant**. Le projet se concentre exclusivement sur la conception et le développement de la **plateforme logicielle complète** (cloud, backend, frontend, data analytics).

---

## 2. Titre du PFE

### Titre principal : 
**« Développement d'une solution cloud de gestion de flotte intelligente »**

## 3. Problématique

**Comment concevoir une plateforme cloud évolutive et sécurisée permettant la collecte, l'analyse et la visualisation en temps réel des données de diagnostic,télématique et géolocalisation issues de dongles OBD, tout en offrant des services à valeur ajoutée (alertes intelligentes, prédiction de pannes, recommandations de maintenance) accessibles via applications web et mobile ?**

## 4. Objectifs du projet

### 4.1 Architecture Cloud
- Concevoir une architecture microservices **scalable et résiliente**
- Mettre en place une infrastructure cloud

### 4.2 Développement Backend/API
- Développer une **API RESTful sécurisée** pour la communication dongle ↔ cloud
- Implémenter l'authentification et l'autorisation
- Gérer l'ingestion de données en temps réel (MQTT, WebSocket, HTTP)

### 4.3 Stockage et gestion des données
- Mettre en place un système de stockage hybride (SQL + NoSQL + Time-Series DB)

### 4.4 Analyse et Intelligence
- Créer un moteur de **recommandations de maintenance**
- Explorer la **prédiction de pannes**
- Générer des alertes intelligentes

### 4.5 Applications Client
- Développer une **application web** (dashboard administrateur)
- Développer une **application mobile** (iOS/Android) pour :
  - Le suivi en temps réel
  - Gestion de véhicule
  - Afficher les codes défaut (DTC)
  - etc..
- Implémenter des **visualisations interactives** (graphiques, cartes GPS, historiques)

---

## 5. Technologies proposées

### Cloud & Infrastructure
- AWS ou Azure pour l'hébergement
- Docker pour la conteneurisation
- Kubernetes pour l'orchestration

### Backend
- Python (FastAPI ou Django) ou Node.js (Express)
- API REST avec documentation Swagger
- MQTT pour la communication avec les dongles

### Base de données
- PostgreSQL pour les données relationnelles
- MongoDB pour les données non structurées
- InfluxDB ou TimescaleDB pour les séries temporelles

### Intelligence & Analyse
- Python (Pandas, Scikit-learn) pour l'analyse de données
- Grafana pour la visualisation des métriques

### Frontend
- React.js ou Vue.js pour l'application web
- React Native ou Flutter pour l'application mobile
- Leaflet ou Google Maps pour les cartes GPS
- Chart.js pour les graphiques

### Sécurité & DevOps
- JWT pour l'authentification
- GitHub Actions pour le CI/CD
- Prometheus et Grafana pour le monitoring

---

## 6. Méthodologie

### Approche Agile (Scrum)
- Sprints de 2 semaines
- Développement itératif du MVP
- Tests continus (Test-Driven Development)
- Revues régulières avec l'encadrant

### Livrables attendus

#### 6.1 Documentation technique
- Architecture système (diagrammes UML)
- Documentation API (OpenAPI/Swagger)
- Guide de déploiement
- Manuel utilisateur

#### 6.2 Code source
- Repository GitHub organisé et documenté
- CI/CD configuré
- Tests unitaires et d'intégration

#### 6.3 Applications
- Dashboard web responsive
- Application mobile
- Interface d'administration

#### 6.4 Rapport PFE
- État de l'art (technologies IoT, cloud, télématique)
- Analyse et conception détaillée
- Implémentation et tests
- Résultats et performances
- Perspectives et améliorations futures


**Auteur** : Soufien Kallel  
**Date** : 7 janvier 2026  
**Type** : Proposition de Projet de Fin d'Études  
**Domaine** : Systèmes embarqués, Cloud Computing, IoT, Applications mobiles