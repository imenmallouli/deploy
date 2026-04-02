# Guide détaillé — Travailler les données Excel (Auto Diagnostic Platform)

Ce document explique pas à pas comment exploiter le fichier Excel généré pour l'analyse, la qualité des données, la préparation IA et les tests backend.

## 1) Fichier source

- Fichier généré : `backend/data/sample_dataset.xlsx`
- Script de génération : `backend/scripts/generate_sample_dataset.py`
- Durée simulée : 7 jours
- Fréquence télémétrie : 1 mesure toutes les 5 minutes
- Flotte simulée : 3 véhicules

## 2) Structure du dataset (4 feuilles)

### 2.1 telemetry_data

Objectif : séries temporelles OBD prêtes pour dashboard, règles d'alerte et features IA.

Colonnes :
- `vehicle_id` : identifiant véhicule
- `plate` : immatriculation
- `device_id` : identifiant boîtier AutoPi
- `ts` : timestamp mesure
- `speed` : vitesse km/h
- `rpm` : régime moteur
- `fuel_level` : niveau carburant (%)
- `engine_temp` : température moteur (°C)
- `battery_voltage` : tension batterie (V)
- `engine_load` : charge moteur (%)
- `ambient_air_temp` : température air ambiant (°C)
- `intake_temp` : température air admission (°C)
- `odometer` : kilométrage (km)

Cas injectés automatiquement :
- batterie basse
- surchauffe moteur
- carburant faible
- rpm élevé

### 2.2 dtc_records

Objectif : historique défauts OBD (diagnostic, priorisation, suivi résolution).

Colonnes :
- `vehicle_id`
- `plate`
- `code` (ex: P0300, P0420, P0171)
- `description`
- `severity` (`info`, `warning`, `critical`)
- `first_detected`
- `last_occurrence`
- `resolved` (true/false)
- `occurrences`

### 2.3 iot_logs

Objectif : journal des événements device (connectivité, sécurité, incidents).

Colonnes :
- `vehicle_id`
- `plate`
- `device_id`
- `event_type` (ignition_on, overspeed, dtc_detected, overheat...)
- `level` (`info`, `warning`, `error`)
- `message`
- `event_at`

### 2.4 ai_labels

Objectif : dataset supervisé pour entraîner un premier modèle de scoring alertes.

Colonnes :
- `vehicle_id`
- `plate`
- `ts`
- `speed`, `rpm`, `engine_temp`, `battery_voltage`, `fuel_level`, `engine_load`
- `rule_triggered`
- `severity`
- `risk_score` (0 à 100)

## 3) Règles métier utilisées pour ai_labels

Les labels sont construits avec un moteur de règles.

- Batterie :
  - `battery_voltage < 11.5` → `BATTERY_CRITICAL` (+40)
  - `battery_voltage < 12.0` → `BATTERY_LOW` (+20)
- Température moteur :
  - `engine_temp > 105` → `ENGINE_OVERHEAT` (+45)
  - `engine_temp > 100` → `ENGINE_HOT` (+20)
- Carburant :
  - `fuel_level < 5` → `FUEL_CRITICAL` (+30)
  - `fuel_level < 15` → `FUEL_LOW` (+15)
- Régime :
  - `rpm > 4500` → `RPM_HIGH` (+5)
- Charge moteur :
  - `engine_load > 85` → `ENGINE_OVERLOAD` (+10)

Score final : somme plafonnée entre 0 et 100.

## 4) Workflow recommandé (de zéro à IA)

### Étape A — Générer/Régénérer le fichier

Depuis la racine du projet :

```powershell
& "C:\auto diagnostic platform\.venv\Scripts\python.exe" "C:\auto diagnostic platform\backend\scripts\generate_sample_dataset.py"
```

Résultat : nouveau fichier `backend/data/sample_dataset.xlsx`.

### Étape B — Contrôle qualité rapide

Checklist minimale avant exploitation :

1. `telemetry_data` :
   - vérifier `ts` trié par véhicule
   - vérifier `odometer` croissant
   - vérifier bornes physiques (`speed >= 0`, `battery_voltage` raisonnable)
2. `dtc_records` :
   - `first_detected <= last_occurrence`
   - `code` non vide
3. `iot_logs` :
   - `event_at` non vide
   - `event_type` dans la liste attendue
4. `ai_labels` :
   - `risk_score` entre 0 et 100
   - cohérence `rule_triggered` / `severity`

### Étape C — Préparation pour BI (dashboard)

KPI recommandés :
- moyenne `speed`, `rpm`, `engine_temp` par véhicule/jour
- top DTC par fréquence (`occurrences`)
- taux incidents : `count(level in warning|error) / total_logs`
- distribution du `risk_score` (0-20, 21-50, 51-80, 81-100)

Visualisations utiles :
- courbe temporelle `engine_temp` et `battery_voltage`
- heatmap des `event_type` par heure
- bar chart DTC par `severity`

### Étape D — Préparation pour modèle IA

Entrées (features) de base :
- `speed`, `rpm`, `engine_temp`, `battery_voltage`, `fuel_level`, `engine_load`

Cible (target) :
- classification : `severity`
- régression : `risk_score`

Split recommandé :
- 70% entraînement
- 15% validation
- 15% test

Bonne pratique : split temporel (éviter fuite de données futures).

### Étape E — Tests backend / API

Cas de test concrets à couvrir :
- ingestion télémétrie avec 9 métriques complètes
- présence des codes DTC critiques (`P0300`, `P0217`, `P0562`)
- corrélation événement overheat dans `iot_logs` avec `engine_temp` élevée

## 5) Exemple d’utilisation Python (lecture et nettoyage)

```python
import pandas as pd

file_path = "backend/data/sample_dataset.xlsx"

telem = pd.read_excel(file_path, sheet_name="telemetry_data")
dtc   = pd.read_excel(file_path, sheet_name="dtc_records")
logs  = pd.read_excel(file_path, sheet_name="iot_logs")
ai    = pd.read_excel(file_path, sheet_name="ai_labels")

telem["ts"] = pd.to_datetime(telem["ts"], errors="coerce")
logs["event_at"] = pd.to_datetime(logs["event_at"], errors="coerce")

telem = telem.dropna(subset=["vehicle_id", "ts"])
telem = telem.sort_values(["vehicle_id", "ts"]).reset_index(drop=True)

# Filtre anomalies batterie
low_battery = telem[telem["battery_voltage"] < 11.5]
print(low_battery[["vehicle_id", "ts", "battery_voltage"]].head())
```

## 6) Convention de versioning du dataset

Pour garder un historique propre, dupliquer le fichier avec version date :
- `sample_dataset_2026-04-01_v1.xlsx`
- `sample_dataset_2026-04-01_v2.xlsx`

Ajouter un onglet `metadata` si besoin avec :
- version générateur
- seed aléatoire
- date/heure génération
- auteur

## 7) Points d’attention

- Le dataset est simulé (réaliste mais non réel).
- Les seuils de règles peuvent être ajustés selon le type de véhicule.
- En production, toujours compléter avec données AutoPi réelles.
- Ne pas ouvrir un fichier `.xlsx` en mode texte dans VS Code : l’affichage sera illisible car binaire compressé.

## 8) Résumé opérationnel

1. Générer le fichier avec le script.
2. Vérifier qualité des 4 feuilles.
3. Utiliser `telemetry_data` + `ai_labels` pour entraînement IA.
4. Utiliser `dtc_records` + `iot_logs` pour diagnostic métier.
5. Versionner chaque génération importante.
