# 📁 STRUCTURE FICHIERS AGENT MALLOULI - VUE COMPLÈTE

**État**: ✅ Prêt pour déploiement  
**Date**: Juin 2026  
**Localisation**: Sur Raspberry Pi AutoPi + PC local

---

## VUE GLOBALE

```
Votre PC (c:\auto diagnostic platform\dongle-agent\)
│
├─ opt/
│  └─ mallouli/
│     └─ agent/
│        └─ main.py                 [Agent principal]
│
├─ etc/
│  ├─ mallouli/
│  │  └─ agent.env                  [Configuration]
│  └─ systemd/system/
│     └─ mallouli-agent.service     [Unit systemd]
│
├─ requirements.txt                 [Dépendances Python]
├─ setup-agent.sh                   [Script d'installation]
└─ connect_to_dongle.py             [SSH diagnostic]

        ↓ (SCP copie)

Dongle (Raspberry Pi AutoPi)
│
├─ /opt/mallouli/agent/
│  └─ main.py                       [Agent exécutable]
│
├─ /etc/mallouli/
│  └─ agent.env                     [Configuration chargée par systemd]
│
├─ /etc/systemd/system/
│  └─ mallouli-agent.service        [Service auto-démarrage]
│
└─ /var/log/mallouli/
   ├─ agent.log                     [Logs stdout]
   └─ agent.err.log                 [Logs stderr]
```

---

## 📋 FICHIERS DÉTAILLÉS

### 1. `opt/mallouli/agent/main.py` (AGENT PRINCIPAL)

**Localisation cible**: `/opt/mallouli/agent/main.py`

**Responsabilités**:
- ✅ Lit unit_id du dongle
- ✅ Boucle infinie toutes les N secondes (PUSH_INTERVAL)
- ✅ Obtient token Local API AutoPi
- ✅ Exécute commandes OBD (RPM, SPEED, FUEL, TEMP, etc.)
- ✅ Formate payload JSON
- ✅ Envoie POST au backend avec retries
- ✅ Gère les erreurs réseau

**Dépendances Python**:
- `requests==2.31.0` (HTTP client)

**Entrée/Sortie**:
- **Entrée**: Variables d'env depuis `/etc/mallouli/agent.env`
- **Sortie**: Logs stdout (visible via `journalctl`)
- **Appels API**: 
  - `GET http://127.0.0.1:9000/` → unit_id
  - `POST http://127.0.0.1:9000/auth/login/` → Local API token
  - `POST http://127.0.0.1:9000/dongle/<unit_id>/execute/` → OBD queries
  - `POST https://api.mallouliauto.tn/api/v1/telemetry` → Backend

**Cycle principal** (pseudo-code):
```
INIT:
  - Charger config depuis env
  - Lire unit_id (stable)
  - Valider config
  
LOOP (infini):
  - Obtenir token Local API
  - Pour chaque commande OBD:
      - Exécuter via /dongle/<unit_id>/execute/
  - Formatter payload telemetry
  - Envoyer POST au backend (3 tentatives si erreur)
  - Attendre PUSH_INTERVAL_SEC
  
SHUTDOWN (Ctrl+C ou crash):
  - Logs cleanup
  - Exit
```

---

### 2. `etc/mallouli/agent.env` (CONFIGURATION)

**Localisation cible**: `/etc/mallouli/agent.env`

**Permissions**: `600` (lecture/écriture root uniquement)

**Chargement**: Via `EnvironmentFile=/etc/mallouli/agent.env` dans le service systemd

**Paramètres**:

| Clé | Valeur | Notes |
|-----|--------|-------|
| `MALLOULI_API_BASE_URL` | `https://api.mallouliauto.tn` | URL du backend FastAPI |
| `MALLOULI_VEHICLE_ID` | `1` | ID du véhicule en base |
| `MALLOULI_DEVICE_ID` | `ccb71376cd13b201170ec917fc1199ff` | UUID du dongle (stable) |
| `MALLOULI_API_TOKEN` | `eyJ...` | JWT token pour authentifier agent |
| `AUTOPI_LOCAL_API` | `http://127.0.0.1:9000` | API locale AutoPi (ne pas modifier) |
| `AUTOPI_UNIT_ID_FILE` | `/etc/salt/minion_id` | Chemin du unit_id (ne pas modifier) |
| `PUSH_INTERVAL_SEC` | `5` | Boucle toutes les 5s |
| `REQUEST_TIMEOUT_SEC` | `10` | Timeout HTTP (5-15s recommended) |
| `MAX_RETRIES` | `3` | Tentatives en cas d'erreur |
| `RETRY_DELAY_SEC` | `2` | Délai entre retries (backoff exponentiel) |
| `LOG_LEVEL` | `INFO` | DEBUG, INFO, WARNING, ERROR |

**Modification**:
```bash
# Éditer
sudo nano /etc/mallouli/agent.env

# Après modification, redémarrer le service
sudo systemctl restart mallouli-agent

# Vérifier les changements ont pris effet
sudo journalctl -u mallouli-agent -f
```

---

### 3. `etc/systemd/system/mallouli-agent.service` (SERVICE)

**Localisation cible**: `/etc/systemd/system/mallouli-agent.service`

**Permissions**: `644` (lecture seule)

**Rôle**: Démarrage/arrêt automatique du service via systemd

**Sections**:

```ini
[Unit]
# Metadata du service
Description=MallouliAuto Dongle Agent
Documentation=https://mallouliauto.tn
After=network-online.target          # Démarrer APRÈS la connexion réseau
Wants=network-online.target

[Service]
# Configuration de l'exécution
Type=simple                          # Simple daemon (pas de fork)
User=pi                              # Exécuté comme utilisateur 'pi'
Group=pi
WorkingDirectory=/opt/mallouli/agent # Répertoire de travail

EnvironmentFile=/etc/mallouli/agent.env  # Charger les variables d'env
ExecStart=/usr/bin/python3 /opt/mallouli/agent/main.py

Restart=always                       # Redémarrer en cas de crash
RestartSec=5                         # Attendre 5s avant restart
StartLimitIntervalSec=60             # Dans une fenêtre de 60s
StartLimitBurst=5                    # Max 5 restarts (burst limit)

StandardOutput=append:/var/log/mallouli/agent.log       # Logs stdout
StandardError=append:/var/log/mallouli/agent.err.log    # Logs stderr

[Install]
WantedBy=multi-user.target           # Activer par défaut au boot
```

**Commandes systemd**:
```bash
# Démarrer
sudo systemctl start mallouli-agent

# Arrêter
sudo systemctl stop mallouli-agent

# Redémarrer (reload config)
sudo systemctl restart mallouli-agent

# Activer au démarrage
sudo systemctl enable mallouli-agent

# Voir le statut
sudo systemctl status mallouli-agent

# Voir les logs
sudo journalctl -u mallouli-agent -f
```

---

### 4. `requirements.txt` (DÉPENDANCES PYTHON)

**Localisation cible**: Installé via `pip3 install -r requirements.txt`

**Contenu**:
```
requests==2.31.0     # HTTP client pour le backend
```

**Installation**:
```bash
# Automatique via setup-agent.sh
# Ou manuel:
pip3 install -r requirements.txt
```

---

### 5. `setup-agent.sh` (SCRIPT D'INSTALLATION)

**Localisation**: Copié temporairement, exécuté une seule fois

**Tâches**:
1. ✅ Créer `/opt/mallouli/agent/`
2. ✅ Créer `/etc/mallouli/`
3. ✅ Créer `/var/log/mallouli/`
4. ✅ Installer pip dependencies
5. ✅ Copier main.py
6. ✅ Copier agent.env
7. ✅ Copier service systemd
8. ✅ Recharger systemd daemon
9. ✅ Activer le service

**Utilisation**:
```bash
# Sur le dongle
cd /tmp
sudo bash setup-agent.sh

# Après: éditer la config
sudo nano /etc/mallouli/agent.env

# Puis démarrer
sudo systemctl start mallouli-agent
```

---

### 6. `/var/log/mallouli/` (LOGS)

**Localisation**: `/var/log/mallouli/`

**Fichiers**:
- `agent.log` → stdout du script (logs normaux)
- `agent.err.log` → stderr du script (erreurs)

**Consultation**:
```bash
# Les 50 dernières lignes
tail -n 50 /var/log/mallouli/agent.log

# Suivre en direct
tail -f /var/log/mallouli/agent.log

# Via journalctl (recommandé)
sudo journalctl -u mallouli-agent -f
```

**Rotation** (optionnel, selon logrotate):
```bash
# Les logs anciens sont archivés automatiquement
# Vérifier la politique
cat /etc/logrotate.d/mallouli  # Si configuré
```

---

## 🔗 FLUX DE DONNÉES

```
┌─ /etc/salt/minion_id (lecture seule)
│  └─ Contient: unit_id du dongle
│
│
│  ┌─ /etc/mallouli/agent.env
│  │  └─ Chargé par systemd via EnvironmentFile
│  │
│  │
│  └─→ /opt/mallouli/agent/main.py (boucle infinie)
│       │
│       ├─ GET http://127.0.0.1:9000/dongle/devices/ (Local API AutoPi)
│       │  └─ Retour: {"unit_id": "...", "display": "Local device"}
│       │
│       ├─ POST http://127.0.0.1:9000/auth/login/ (Local API AutoPi)
│       │  └─ Retour: {"token": "jwt_token..."}
│       │
│       ├─ POST http://127.0.0.1:9000/dongle/<unit_id>/execute/
│       │  ├─ Commande: "obd.query RPM"
│       │  ├─ Commande: "obd.query SPEED"
│       │  ├─ ...7 autres commandes OBD
│       │  └─ Retour: {"value": 3000.0}, {"value": 85.5}, etc.
│       │
│       └─ POST https://api.mallouliauto.tn/api/v1/telemetry
│          ├─ Auth: Bearer <MALLOULI_API_TOKEN>
│          ├─ Body: {"vehicle_id": 1, "speed": 85.5, "rpm": 3000, ...}
│          └─ Retour: {"status": "ok", "record_id": 12345}
│
├─ /var/log/mallouli/agent.log (stdout logs)
└─ /var/log/mallouli/agent.err.log (stderr logs)
   └─ Visible via: journalctl -u mallouli-agent -f
```

---

## ⚙️ INTÉGRATION SYSTÈME

### Démarrage Automatique

1. **Boot du dongle**
   - systemd lit `/etc/systemd/system/mallouli-agent.service`
   - Chargement des variables d'env depuis `/etc/mallouli/agent.env`
   - Exécution: `/usr/bin/python3 /opt/mallouli/agent/main.py`

2. **Redémarrage Auto en Cas de Crash**
   - Service plante (exception non gérée)
   - systemd détecte l'arrêt (Restart=always)
   - Attente de 5 secondes (RestartSec=5)
   - Relance du script
   - Logs du crash dans `journalctl`

3. **Arrêt Propre**
   - User exécute: `sudo systemctl stop mallouli-agent`
   - systemd envoie signal SIGTERM au processus
   - Script Python catchhe le signal (KeyboardInterrupt)
   - Fermeture des ressources
   - Exit code 0

### Intégration avec AutoPi

L'agent utilise **UNIQUEMENT** :
- ✅ Local API AutoPi (port 9000) - **Lecture seule**
- ✅ Fichiers config AutoPi (lecture seule)

L'agent **NE modifie JAMAIS** :
- ❌ Les services AutoPi
- ❌ Les fichiers de config AutoPi
- ❌ Les settings réseau ou CAN bus
- ❌ Les loggers ou reactors AutoPi

**Coexistence**: Complètement indépendant d'AutoPi. Peut tournér simultanément sans conflits.

---

## 📊 CHECKLIST DEPLOYMENT

```bash
# Sur votre PC
[ ] Fichiers présents dans c:\auto diagnostic platform\dongle-agent\
[ ] agent.env édité avec les 3 paramètres (DEVICE_ID, VEHICLE_ID, TOKEN)
[ ] setup-agent.sh exécutable (chmod +x)

# Sur le dongle (via SSH)
[ ] IP du dongle accessible (ping 192.168.1.147)
[ ] SSH fonctionnel (ssh pi@192.168.1.147)
[ ] Fichiers copiés via SCP (/tmp/mallouli-agent.tar.gz)
[ ] script d'installation exécuté (sudo bash setup-agent.sh)
[ ] /opt/mallouli/agent/main.py présent
[ ] /etc/mallouli/agent.env présent et édité
[ ] /etc/systemd/system/mallouli-agent.service présent

# Tests
[ ] Service démarre sans erreur (sudo systemctl start mallouli-agent)
[ ] Logs visibles (sudo journalctl -u mallouli-agent -f)
[ ] Données envoyées au backend (curl -H "Auth: Bearer ..." ... /api/v1/telemetry)
[ ] Alertes générées si données critiques

# Production
[ ] Service activé au boot (sudo systemctl enable mallouli-agent)
[ ] Monitoring configuré (ex: alertes systemd)
[ ] Rotation des logs configurée (logrotate)
[ ] Backup de la config (git, ...?)
```

---

## 📞 FICHIERS RÉFÉRENCES

| Fichier | Chemin PC | Chemin Dongle | Purpose |
|---------|-----------|---------------|---------|
| Agent Python | `opt/mallouli/agent/main.py` | `/opt/mallouli/agent/main.py` | Script principal |
| Config | `etc/mallouli/agent.env` | `/etc/mallouli/agent.env` | Variables d'env |
| Service | `etc/systemd/system/mallouli-agent.service` | `/etc/systemd/system/mallouli-agent.service` | Systemd unit |
| Setup | `setup-agent.sh` | `/tmp/setup-agent.sh` (temporaire) | Installation script |
| Requirements | `requirements.txt` | N/A | Dépendances Python |
| Logs stdout | N/A | `/var/log/mallouli/agent.log` | Logs normaux |
| Logs stderr | N/A | `/var/log/mallouli/agent.err.log` | Erreurs |

---

**✅ Statut**: Tous les fichiers sont prêts pour déploiement !

Voir: [GUIDE_INSTALLATION_SSH_DONGLE.md](GUIDE_INSTALLATION_SSH_DONGLE.md) pour les étapes complètes.
