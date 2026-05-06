# 🧪 E2E Test Complet - Platform Auto Diagnostic

## 📋 Objectif
Tester le flux **complet** de la plateforme en simulant un véhicule réel (Vehicle 11 / 100TN 6000) avec:
1. Injection de données télémétriques en temps réel (toutes les 2 minutes)
2. Génération automatique de codes DTC selon les seuils
3. Déclenchement automatique des alertes via IA
4. Vérification que chaque page affiche les données correctement

---

## 🚀 Démarrage du Test

### Étape 1: Lancer le stream en arrière-plan dans le container

```bash
cd "c:\auto diagnostic platform"
docker exec -d adp-backend python scripts/run_vehicle11_2min_stream.py
```

Le stream va:
- ✅ Injecter telemetry toutes les 120 secondes
- ✅ Créer des codes DTC à chaque cycle
- ✅ Générer des alertes via IA
- ✅ Continuer indéfiniment jusqu'à `Ctrl+C` ou arrêt container

### Étape 2: Ouvrir le navigateur

Accédez à: **http://127.0.0.1:5173**

---

## ✅ Checklist de Vérification - Page par Page

### 1️⃣ **Dashboard** (`/dashboard`)
**URL**: http://127.0.0.1:5173/dashboard

**Éléments à vérifier**:
- [ ] Vehicle 11 (100TN 6000) apparaît dans la liste
- [ ] Dernières alertes affichées
- [ ] Nombre total d'alertes > 0 (après ~2-3 minutes)
- [ ] Status du véhicule: "critical" ou "warning"

**Données attendues**:
- ~3 alertes créées par cycle
- Sévérité: CRITICAL ou WARNING

---

### 2️⃣ **Télémétrie** (`/telemetry`)
**URL**: http://127.0.0.1:5173/telemetry

**Actions**:
1. Ouvrir la page
2. Sélectionner le véhicule: **100TN 6000 (vehicle 11)**
3. Observer le panneau "Live" (badge vert en haut à droite)

**Éléments à vérifier en temps réel**:
- [ ] Badge "Live" passe au **vert** (connecté au WebSocket)
- [ ] **Tableau temps réel** en bas → affiche les dernières données
- [ ] Champs mis à jour toutes les ~2 minutes:
  - **Vitesse** (speed): 90-100 km/h
  - **RPM**: 3800-4500
  - **Température moteur** (engine_temp): 106-109°C
  - **Niveau carburant** (fuel_level): 5-15%
  - **Tension batterie** (battery_voltage): 11.2-11.4V
  - **Charge moteur** (engine_load): 85-95%

**Graphiques (KPI Cards)**:
- [ ] Courbes historiques affichées
- [ ] Données lissées par intervalle (5m ou 1h)
- [ ] Tendances calculées

**Export CSV**:
- [ ] Bouton "Exporter" fonctionne
- [ ] Fichier généré: `telemetry-11.csv`

---

### 3️⃣ **Diagnostic (DTC)** (`/dtc`)
**URL**: http://127.0.0.1:5173/dtc

**Actions**:
1. Sélectionner le véhicule: **100TN 6000**
2. Attendre le chargement de la page

**Éléments à vérifier**:
- [ ] Tableau DTC affiche les codes:
  - ✅ **P0562** - Battery low (CRITICAL)
  - ✅ **P0217** - Engine overheat (CRITICAL)
  - ✅ **P0300** - Misfire (CRITICAL)
  - ✅ **P0171** - System lean (WARNING)
  - ✅ **P0087** - Fuel pressure low (WARNING)

**Colonnes du tableau**:
- [ ] **Code**: P0562, P0217, etc.
- [ ] **Description**: "System voltage low", "Engine over-temperature condition", etc.
- [ ] **Sévérité**: "critical" (rouge) ou "warning" (orange)
- [ ] **Occurrences**: Compte les apparitions
- [ ] **Dernière occurrence**: Timestamp récent

**AI Diagnostic**:
- [ ] Panneau "AI Diagnostic" affiche un **severity** prédit
- [ ] Exemple: "CRITICAL" ou "WARNING"
- [ ] Risk score: valeur numérique (0-100)

**Actions possibles**:
- [ ] Bouton "Clear DTC" → efface les codes sélectionnés
- [ ] Bouton "History" → affiche l'historique d'un code spécifique

---

### 4️⃣ **Alertes** (`/alerts`)
**URL**: http://127.0.0.1:5173/alerts

**Éléments à vérifier**:
- [ ] **Total d'alertes**: > 0 après 2-3 minutes
- [ ] Répartition par sévérité:
  - 🔴 **Critical**: au moins 3 (battery, overheat, misfire)
  - 🟠 **Warning**: au moins 2 (fuel, load)
- [ ] **Colonnes du tableau**:
  - [ ] Type: "thermal_delta", "fuel", "engine_load", etc.
  - [ ] Sévérité: badge coloré (rouge/orange)
  - [ ] Status: "pending" (bleu) ou "acknowledged" (gris)
  - [ ] Créé le: timestamp récent (< 5 min)

**Tests interactifs**:
- [ ] Cliquer sur une alerte → détails affichés
- [ ] Bouton "Acknowledge" → alerte passe en gris
- [ ] Note optionnelle → peut être ajoutée
- [ ] Filtrer par sévérité (Critical/Warning) → fonctionne

**Tabs**:
- [ ] Tab "All" → toutes les alertes
- [ ] Tab "Critical" → affiche les critiques
- [ ] Tab "Warning" → affiche les avertissements

---

### 5️⃣ **Historique Véhicule** (`/vehicles`)
**URL**: http://127.0.0.1:5173/vehicles

**Actions**:
1. Sélectionner vehicle 11 (100TN 6000)
2. Cliquer sur "Détails" ou l'avertissement

**Éléments à vérifier**:
- [ ] **Informations du véhicule**:
  - Plaque: 100TN 6000
  - VIN: visible
  - Dongle: c917fc1199ff
  - Status: "critical" ou "warning"
  - Kilométrage: augmente avec les données (odometer)

- [ ] **Historique des alertes** (si accessible):
  - [ ] Liste des alertes passées
  - [ ] Chronologie correcte (récentes en premier)

---

## 📊 Données Attendues par Cycle (120s)

### Cycle 1 (T+0s → T+120s)
```
[SIM] 2026-05-06T20:XX:XX.XXX | speed=90-100 km/h | dtc+=3 | alerts+=3
→ Crée: P0562, P0217, P0300 (tous CRITICAL)
→ Alertes générées: battery_critical, overheat_critical, misfire_critical
```

### Cycle 2 (T+120s → T+240s)
```
[SIM] 2026-05-06T20:XX:XX.XXX | speed=90-100 km/h | dtc+=3 | alerts+=2
→ Crée: P0562, P0217, P0300 (réplique + nouvelles)
→ Alertes générées: fuel_warning, load_warning
```

### Cycle N
- Telemetry: 1 point par cycle (à la fin des 120s)
- DTC: 3-5 codes selon les seuils
- Alerts: 2-5 alertes créées

---

## 🔍 Vérification des Seuils IA

Les alertes se déclenchent selon ces **seuils** (appliqués à la telemetry):

| Métrique | Seuil Warning | Seuil Critical |
|----------|---------------|---|
| **Battery** | < 12.0V | < 11.5V |
| **Engine Temp** | ≥ 100°C | ≥ 110°C |
| **Fuel Level** | < 15% | < 10% |
| **RPM** | > 3500 | > 4500 |
| **Engine Load** | > 80% | > 90% |

**Le stream critique génère**:
- Temp: ~107°C → WARNING + CRITICAL
- Battery: ~11.2V → CRITICAL
- Fuel: ~8% → CRITICAL
- RPM: ~4300 → WARNING
- Load: ~85% → WARNING

---

## 🐛 Troubleshooting

### Le stream ne démarre pas
```bash
# Vérifier que les scripts sont dans le container:
docker exec adp-backend ls -la /app/scripts/run_vehicle11_2min_stream.py

# Vérifier les logs du container:
docker logs adp-backend --tail=100
```

### Pas de données en temps réel
- Vérifier que le badge "Live" est **vert** (page Télémétrie)
- Attendre 2-3 minutes (intervalle de 120s)
- Rafraîchir la page (F5)

### Alertes n'apparaissent pas
- Vérifier page Diagnostic → codes DTC présents?
- Vérifier que la sévérité des alertes est "warning" ou "critical"
- Vérifier la sévérité prédite par AI (page Diagnostic → AI Diagnostic)

### Impossible de sélectionner Vehicle 11
- Vérifier que le compte utilisé a les bonnes permissions
- Vérifier que le Token JWT est valide (Browser console → errors)

---

## 📝 Rapport Final

Une fois tous les tests validés, tu peux documenter:

✅ **Test réussi** si:
- [ ] Télémétrie affichée en temps réel (KPI + graphiques)
- [ ] 5+ codes DTC visibles dans Diagnostic
- [ ] 3+ alertes CRITICAL + 2+ alertes WARNING dans Alertes
- [ ] Historique cohérent (timestamps croissants)
- [ ] Sévérité AI calculée correctement

❌ **Problèmes** (le cas échéant):
- [ ] Données non visibles après 5 min
- [ ] Codes DTC incomplets
- [ ] Alertes manquantes ou incorrectes
- [ ] Graphiques vides

---

## ⏸️ Arrêter le Stream

```bash
# Dans le container:
docker exec adp-backend pkill -f run_vehicle11_2min_stream

# Ou arrêter tout le container:
docker stop adp-backend
```

---

**Prêt pour le test ? Bonne chance ! 🚀**
