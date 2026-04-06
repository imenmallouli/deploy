# Guide détaillé — Étape IA `Preprocessing & Training`

Ce document explique **comment travailler correctement l’étape de preprocessing et training**, puis **comment la tester** dans le projet **Auto Diagnostic Platform**.

---

## 1. Objectif de cette étape

Avant que l’application puisse faire des prédictions IA, il faut préparer et entraîner le modèle.

Cette étape sert à :
- nettoyer les données télémétriques,
- créer des variables utiles (*features*),
- entraîner un modèle de classification et un modèle de régression,
- sauvegarder les modèles pour les réutiliser dans le backend.

En résumé :

```text
Dataset brut → Nettoyage → Features → Entraînement → Modèles sauvegardés
```

---

## 2. Fichiers utilisés dans le projet

### Fichiers principaux
- `backend/data/sample_dataset.xlsx` → dataset d’entrée
- `backend/app/services/ia/data_cleaner.py` → nettoyage des données
- `backend/app/services/ia/feature_engineering.py` → création des features
- `backend/scripts/train_alert_model.py` → script d’entraînement

### Fichiers générés après entraînement
- `backend/data/models/severity_classifier.joblib`
- `backend/data/models/risk_regressor.joblib`
- `backend/data/models/training_metrics.json`

---

## 3. Données utilisées pour l’entraînement

Le dataset contient 4 feuilles :

| Feuille | Rôle |
|---|---|
| `telemetry_data` | Données capteurs OBD (vitesse, rpm, batterie, température...) |
| `dtc_records` | Codes défauts OBD |
| `iot_logs` | Logs événements device |
| `ai_labels` | Labels utilisés pour l’apprentissage (`severity`, `risk_score`) |

Pour l’entraînement actuel, le script utilise surtout :
- `telemetry_data`
- `ai_labels`

---

## 4. Étape 1 — Preprocessing (Nettoyage des données)

Le preprocessing est implémenté dans `backend/app/services/ia/data_cleaner.py`.

### 4.1 Pourquoi nettoyer ?

Les données brutes peuvent contenir :
- des dates invalides,
- des doublons,
- des valeurs impossibles,
- des colonnes vides,
- des formats incohérents.

Si on entraîne un modèle sur des données sales, le résultat est mauvais.

### 4.2 Ce que fait `clean_telemetry_dataframe()`

Cette fonction :

1. vérifie que les colonnes obligatoires existent :
   - `vehicle_id`
   - `ts`

2. convertit `ts` en format datetime,
3. supprime les lignes sans date valide,
4. trie les données par `vehicle_id` puis `ts`,
5. supprime les doublons exacts (`vehicle_id + ts`),
6. contrôle les plages valides par capteur,
7. transforme les valeurs impossibles en `NaN`,
8. applique une interpolation linéaire,
9. remplit les valeurs restantes par la médiane.

### 4.3 Seuils numériques utilisés

| Colonne | Intervalle accepté |
|---|---:|
| `speed` | 0 à 220 |
| `rpm` | 0 à 8000 |
| `fuel_level` | 0 à 100 |
| `engine_temp` | -40 à 130 |
| `battery_voltage` | 9 à 16 |
| `engine_load` | 0 à 100 |
| `ambient_air_temp` | -20 à 60 |
| `intake_temp` | -20 à 80 |
| `odometer` | 0 à 2 000 000 |
| `risk_score` | 0 à 100 |

### 4.4 Ce que fait `clean_label_dataframe()`

Cette fonction nettoie les labels IA :
- conversion de `ts`,
- validation de `risk_score`,
- normalisation de `severity`,
- suppression des lignes invalides.

Les valeurs acceptées pour `severity` sont :
- `info`
- `warning`
- `critical`

---

## 5. Étape 2 — Feature Engineering

Le feature engineering est implémenté dans `backend/app/services/ia/feature_engineering.py`.

### 5.1 Pourquoi créer des features ?

Les colonnes brutes ne suffisent pas toujours pour détecter un problème.

Exemple :
- une température instantanée peut sembler normale,
- mais une **température qui monte régulièrement** est un vrai signal d’alerte.

Le rôle des features est donc de transformer les données brutes en variables plus utiles pour le modèle.

### 5.2 Features créées automatiquement

#### A. Moyennes glissantes
Pour plusieurs capteurs, le script calcule :
- `*_mean_3`
- `*_mean_12`

Exemples :
- `speed_mean_3`
- `rpm_mean_12`
- `engine_temp_mean_3`
- `battery_voltage_mean_12`

#### B. Variations
Le script calcule aussi les écarts :
- `battery_voltage_delta`
- `engine_temp_delta`
- `fuel_level_delta`

Cela permet de voir si une valeur augmente ou diminue rapidement.

#### C. Flags métier (0 ou 1)
- `is_idling`
- `is_overheating`
- `is_battery_low`
- `is_low_fuel`
- `is_engine_overload`
- `high_rpm_flag`

#### D. Durée de ralenti
- `idle_duration_min`

Cette variable mesure combien de minutes le véhicule reste au ralenti de manière continue.

---

## 6. Étape 3 — Training (Entraînement du modèle)

L’entraînement est implémenté dans `backend/scripts/train_alert_model.py`.

### 6.1 Modèles entraînés

Deux modèles sont construits :

#### A. Modèle de classification
Fichier généré : `severity_classifier.joblib`

Rôle : prédire le niveau d’alerte :
- `info`
- `warning`
- `critical`

Modèle utilisé :
- `RandomForestClassifier`

#### B. Modèle de régression
Fichier généré : `risk_regressor.joblib`

Rôle : prédire le score de risque numérique : 

- `risk_score` entre 0 et 100

Modèle utilisé :
- `RandomForestRegressor`

### 6.2 Variables utilisées pour l’apprentissage

Le script utilise actuellement **28 features**.

Exemples principaux :
- `speed`
- `rpm`
- `engine_temp`
- `battery_voltage`
- `fuel_level`
- `engine_load`
- `speed_mean_3`
- `rpm_mean_12`
- `battery_voltage_delta`
- `is_overheating`
- `is_battery_low`
- `idle_duration_min`

### 6.3 Split des données

Le script sépare automatiquement les données en :
- **80% entraînement**
- **20% test**

Cela permet d’évaluer le modèle sur des données qu’il n’a pas vues pendant l’apprentissage.

---

## 7. Comment lancer cette étape

Depuis la racine du projet :

```powershell
& "C:\auto diagnostic platform\.venv\Scripts\python.exe" "C:\auto diagnostic platform\backend\scripts\train_alert_model.py"
```

### Résultat attendu
Le script doit afficher quelque chose comme :

```text
⏳ Loading dataset and running preprocessing...
Using dataset: C:\auto diagnostic platform\backend\data\sample_dataset.xlsx
✅ Training completed
Dataset rows: 1210
Severity distribution: {'info': 805, 'warning': 400, 'critical': 5}
Classifier accuracy: 0.9959
Risk MAE: 0.0554
Risk R²: 0.9981
```

---

## 8. Comment tester cette étape

Le test doit se faire en plusieurs niveaux.

---

### Test 1 — Vérifier que le dataset est lisible

```python
import pandas as pd

file_path = r"backend/data/sample_dataset.xlsx"
telem = pd.read_excel(file_path, sheet_name="telemetry_data")
ai = pd.read_excel(file_path, sheet_name="ai_labels")

print(telem.shape)
print(ai.shape)
print(ai["severity"].value_counts())
```

### Ce qu’il faut vérifier
- le fichier s’ouvre sans erreur,
- les feuilles existent,
- `severity` contient plusieurs classes,
- `risk_score` existe.

---

### Test 2 — Vérifier le nettoyage

Exemple simple :

```python
import pandas as pd
from app.services.ia.data_cleaner import clean_telemetry_dataframe

raw = pd.read_excel(r"backend/data/sample_dataset.xlsx", sheet_name="telemetry_data")
cleaned = clean_telemetry_dataframe(raw)

print("Avant:", raw.shape)
print("Après:", cleaned.shape)
print(cleaned[["speed", "rpm", "engine_temp"]].isna().sum())
```

### Ce qu’il faut vérifier
- pas d’erreur Python,
- dates bien converties,
- pas de doublons exacts,
- pas de valeurs absurdes après nettoyage.

---

### Test 3 — Vérifier le feature engineering

```python
import pandas as pd
from app.services.ia.data_cleaner import clean_telemetry_dataframe
from app.services.ia.feature_engineering import build_telemetry_features

raw = pd.read_excel(r"backend/data/sample_dataset.xlsx", sheet_name="telemetry_data")
cleaned = clean_telemetry_dataframe(raw)
featured = build_telemetry_features(cleaned)

print(featured.columns.tolist())
print(featured[["speed_mean_3", "is_overheating", "idle_duration_min"]].head())
```

### Ce qu’il faut vérifier
- les nouvelles colonnes existent,
- pas de crash,
- les flags métier sont bien en `0/1`.

---

### Test 4 — Vérifier l’entraînement complet

Lancer :

```powershell
& "C:\auto diagnostic platform\.venv\Scripts\python.exe" "C:\auto diagnostic platform\backend\scripts\train_alert_model.py"
```

### Vérifications attendues
Après exécution, ces fichiers doivent exister :
- `backend/data/models/severity_classifier.joblib`
- `backend/data/models/risk_regressor.joblib`
- `backend/data/models/training_metrics.json`

---

### Test 5 — Vérifier les métriques

Ouvrir le fichier :
- `backend/data/models/training_metrics.json`

Métriques réelles observées actuellement :
- `dataset_rows`: **1210**
- `feature_count`: **28**
- `accuracy`: **0.9958677685950413**
- `mae`: **0.05538016528925622**
- `r2`: **0.9981235950519547**

> Attention : ces résultats sont très bons parce que le dataset est simulé et propre.

---

## 9. Interprétation correcte des résultats

### Accuracy élevée ≠ modèle parfait
Même si l’accuracy est très haute, il faut faire attention.

Dans le fichier `training_metrics.json`, on voit :
- `info`: 805
- `warning`: 400
- `critical`: 5

Donc la classe `critical` est très rare.

Conséquence :
- le modèle semble très performant,
- mais il a encore peu d’exemples critiques,
- donc il faudra enrichir les données réelles plus tard.

### Ce qu’il faut dire dans le rapport
Dans le rapport, il faut expliquer que :
1. le pipeline fonctionne techniquement,
2. les modèles sont entraînés correctement,
3. les métriques sont prometteuses,
4. mais l’échantillon reste simulé et déséquilibré pour certains cas critiques.

---

## 10. Problèmes possibles et solutions

### Problème 1 — `ModuleNotFoundError: No module named 'backend'`
**Cause :** le script est lancé depuis un mauvais dossier ou le chemin Python n’est pas chargé.

**Solution :**
Lancer la commande depuis la racine du projet :

```powershell
Set-Location "C:\auto diagnostic platform"
& "C:\auto diagnostic platform\.venv\Scripts\python.exe" "C:\auto diagnostic platform\backend\scripts\train_alert_model.py"
```

### Problème 2 — Excel ouvert
**Cause :** `sample_dataset.xlsx` est ouvert dans Excel.

**Solution :** fermer Excel avant de régénérer ou modifier le fichier.

### Problème 3 — Pas de classe `warning` ou `info`
**Cause :** labels mal générés ou dataset déséquilibré.

**Solution :** vérifier la feuille `ai_labels` et la logique de génération des labels.

---

## 11. Comment présenter cette étape dans le rapport / PFE

Tu peux organiser la partie rapport comme ceci :

### 11.1 Préprocessing
- conversion temporelle,
- suppression des doublons,
- gestion des valeurs manquantes,
- validation des plages capteurs.

### 11.2 Feature Engineering
- moyennes glissantes,
- dérivées / variations,
- variables binaires métier,
- durée de ralenti.

### 11.3 Training
- choix du dataset,
- séparation train/test,
- algorithmes choisis : Random Forest,
- métriques obtenues.

### 11.4 Limites
- dataset simulé,
- faible nombre de cas critiques,
- besoin d’enrichissement avec données réelles AutoPi.

---

## 12. Résumé final

Cette étape est maintenant **fonctionnelle** dans le projet.

### Ce qui est prêt
- nettoyage automatique des données,
- création des features,
- entraînement des modèles,
- sauvegarde des résultats,
- métriques exportées.

### Prochaine étape logique
- intégrer les modèles dans le backend,
- exposer une API de prédiction,
- afficher les alertes dans l’application.
