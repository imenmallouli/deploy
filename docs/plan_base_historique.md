# Spécification Détaillée — Base Unique TimescaleDB

## 1) But du document
Décrire exactement ce que contient la base **TimescaleDB** comme base unique d’historique.

---

## 2) Données stockées dans TimescaleDB

### 2.1 Télémétrie brute (time-series)
Table principale hypertable: `telemetry_history`

Champs:
- `time` (timestamp UTC)
- `vehicle_id`
- `speed`
- `rpm`
- `engine_temp`
- `fuel_level`
- `battery_voltage`
- `latitude`
- `longitude`
- `odometer`
- `ingested_at`

### 2.2 DTC historiques (événements)
Table: `dtc_events_history`

Champs:
- `event_time`
- `vehicle_id`
- `dtc_code`
- `category`
- `severity`
- `description`
- `first_detected`
- `last_occurrence`
- `occurrence_count`
- `resolved`
- `resolved_at`
- `cleared_at`
- `cleared_by`

### 2.3 Alertes historiques
Table: `alerts_history`

Champs:
- `created_at`
- `vehicle_id`
- `alert_type`
- `severity`
- `title`
- `message`
- `status`
- `acknowledged_at`
- `acknowledged_by`
- `resolved_at`
- `note`

---

## 3) Agrégations recommandées

### 3.1 Continuous Aggregates
- `telemetry_1m`
- `telemetry_5m`
- `telemetry_1h`

Mesures agrégées:
- `avg_speed`, `max_speed`
- `avg_rpm`, `max_rpm`
- `avg_engine_temp`, `max_engine_temp`
- `min_battery_voltage`, `max_battery_voltage`

---

## 4) Index minimum
- `(vehicle_id, time DESC)` sur `telemetry_history`
- `(vehicle_id, event_time DESC)` sur `dtc_events_history`
- `(vehicle_id, created_at DESC)` sur `alerts_history`
- `(dtc_code, event_time DESC)` pour recherche par code DTC
- `(status, severity, created_at DESC)` pour alertes

---

## 5) Rétention et compression
- Données brutes: 12 mois
- Compression automatique après 7 jours
- Données agrégées: 24 mois
- Purge mensuelle des données expirées

---

## 6) Règles de qualité
- Horodatage UTC obligatoire (`...Z`)
- `vehicle_id` obligatoire sur toutes les tables
- Idempotence d’écriture recommandée (clé logique par événement)
- Validation des valeurs hors plage (speed, rpm, température)

---

## 7) Fonctions à ajouter (TimescaleDB)

### 7.1 Fonctions d’ingestion

1. `fn_insert_telemetry(...)`
- But: insérer une mesure télémétrique validée dans `telemetry_history`.
- Vérifie: `vehicle_id` non nul, timestamp UTC, plages de valeurs.
- Retour: `id` logique ou statut (`ok`/`error`).

2. `fn_insert_dtc_event(...)`
- But: insérer un événement DTC dans `dtc_events_history`.
- Gère: déduplication logique (même `vehicle_id`, `dtc_code`, `event_time`).
- Retour: statut + message.

3. `fn_insert_alert_event(...)`
- But: insérer une alerte dans `alerts_history`.
- Gère: statut initial (`pending`) si non fourni.

### 7.2 Fonctions de lecture historique

4. `fn_get_telemetry_window(p_vehicle_id, p_start, p_end, p_limit)`
- But: lire l’historique brut d’un véhicule sur intervalle.
- Retour: lignes ordonnées par `time DESC`.

5. `fn_get_dtc_history(p_vehicle_id, p_dtc_code, p_start, p_end)`
- But: retourner l’historique DTC filtré.
- Retour: occurrences + états (`resolved`, `cleared`).

6. `fn_get_alerts_history(p_vehicle_id, p_status, p_severity, p_start, p_end)`
- But: retourner l’historique des alertes avec filtres.

### 7.3 Fonctions d’agrégation

7. `fn_get_telemetry_agg(p_vehicle_id, p_start, p_end, p_bucket)`
- But: retourner les agrégats (`avg`, `max`, `min`) par bucket (`1m`, `5m`, `1h`).
- Source: vues continues (`telemetry_1m`, `telemetry_5m`, `telemetry_1h`).

### 7.4 Fonctions de maintenance

8. `fn_run_retention()`
- But: exécuter la purge selon la politique de rétention.

9. `fn_run_compression()`
- But: compresser les chunks plus anciens que 7 jours.

10. `fn_refresh_continuous_aggregates(p_start, p_end)`
- But: rafraîchir les agrégations pour une fenêtre donnée.

---

## 8) Résumé “ce que contient la base”
La base TimescaleDB contient:
- historique télémétrie (`telemetry_history`)
- historique DTC (`dtc_events_history`)
- historique alertes (`alerts_history`)
- tables d’agrégation (`telemetry_1m`, `telemetry_5m`, `telemetry_1h`)

---

**Version**: 2.0  
**Date**: 2026-02-26  
**Projet**: Auto Diagnostic Platform
