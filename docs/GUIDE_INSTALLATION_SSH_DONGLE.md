# 📱 GUIDE INSTALLATION AGENT MALLOULI SUR DONGLE VIA SSH

**Date**: Juin 2026  
**Plateforme**: Auto Diagnostic Platform  
**Cible**: Raspberry Pi AutoPi (Dongle OBD-II)

---

## TABLE DES MATIÈRES

1. [Prérequis](#1-prérequis)
2. [Connexion SSH au dongle](#2-connexion-ssh-au-dongle)
3. [Copie des fichiers via SCP](#3-copie-des-fichiers-via-scp)
4. [Installation via script setup](#4-installation-via-script-setup)
5. [Configuration manuelle](#5-configuration-manuelle)
6. [Vérification et tests](#6-vérification-et-tests)
7. [Dépannage](#7-dépannage)
8. [Commandes utiles](#8-commandes-utiles)

---

## 1. PRÉREQUIS

Avant de commencer, assurez-vous d'avoir :

- ✅ **Dongle AutoPi physique** connecté au véhicule (OBD-II port)
- ✅ **Dongle connecté à internet** (WiFi ou 4G)
- ✅ **IP du dongle** : 192.168.1.147 (ou trouvez-la avec `arp-scan`)
- ✅ **SSH enabled** sur le dongle (AutoPi l'active par défaut)
- ✅ **Identifiants SSH** : 
  - User: `pi`
  - Password: `raspberry` (par défaut, changez-le!)
- ✅ **Backend Mallouli déployé** avec un JWT token valide

---

## 2. CONNEXION SSH AU DONGLE

### 2.1 Test de connectivité

```bash
# Vérifier que le dongle est accessible
ping 192.168.1.147

# Ou depuis Windows PowerShell
Test-Connection 192.168.1.147
```

### 2.2 Connexion SSH simple

```bash
# Linux/Mac
ssh pi@192.168.1.147

# Windows (si OpenSSH installé)
ssh pi@192.168.1.147

# Windows (sans SSH natif, utiliser Git Bash ou PuTTY)
# Télécharger PuTTY: https://www.putty.org/
```

### 2.3 Connexion avec clé SSH (recommandé)

Pour éviter de taper le mot de passe à chaque fois :

```bash
# Sur votre PC, générer une paire SSH si vous n'en avez pas
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa

# Copier la clé publique sur le dongle
ssh-copy-id -i ~/.ssh/id_rsa.pub pi@192.168.1.147

# Maintenant connectez-vous sans mot de passe
ssh pi@192.168.1.147
```

---

## 3. COPIE DES FICHIERS VIA SCP

### 3.1 Depuis votre PC vers le dongle

```bash
# Créer un dossier temporaire sur votre PC avec tous les fichiers:
# c:\auto diagnostic platform\dongle-agent\
#   ├── opt/mallouli/agent/main.py
#   ├── etc/mallouli/agent.env
#   ├── etc/systemd/system/mallouli-agent.service
#   ├── requirements.txt
#   └── setup-agent.sh

# Copier le dossier complet vers le dongle
scp -r opt pi@192.168.1.147:/tmp/
scp -r etc pi@192.168.1.147:/tmp/
scp requirements.txt pi@192.168.1.147:/tmp/
scp setup-agent.sh pi@192.168.1.147:/tmp/

# Vérifier que les fichiers sont arrivés
ssh pi@192.168.1.147 "ls -la /tmp/opt /tmp/etc /tmp/*.txt /tmp/*.sh"
```

### 3.2 Alternative: Un seul fichier .tar.gz

```bash
# Compresser sur votre PC
tar -czf mallouli-agent.tar.gz opt/ etc/ requirements.txt setup-agent.sh

# Copier
scp mallouli-agent.tar.gz pi@192.168.1.147:/tmp/

# Sur le dongle, extraire
ssh pi@192.168.1.147 "cd /tmp && tar -xzf mallouli-agent.tar.gz && ls -la"
```

---

## 4. INSTALLATION VIA SCRIPT SETUP

### 4.1 Sur le dongle (via SSH)

```bash
# Se connecter au dongle
ssh pi@192.168.1.147

# Aller au répertoire tmp
cd /tmp

# Rendre le script exécutable
chmod +x setup-agent.sh

# Lancer l'installation (avec sudo pour les droits)
sudo bash setup-agent.sh

# L'output devrait ressembler à:
# 🚀 Installation MallouliAuto Dongle Agent
# 
# 1️⃣  Créer les répertoires...
# 2️⃣  Installer les dépendances Python...
# 3️⃣  Copier le script agent...
# 4️⃣  Copier la configuration...
# 5️⃣  Installer le service systemd...
#
# ✅ Installation terminée!
```

### 4.2 Vérifier les fichiers créés

```bash
# Lister les fichiers créés
sudo ls -la /opt/mallouli/agent/
sudo ls -la /etc/mallouli/
sudo ls -la /etc/systemd/system/mallouli-agent.service
sudo ls -la /var/log/mallouli/
```

---

## 5. CONFIGURATION MANUELLE

### 5.1 Éditer agent.env

```bash
# Sur le dongle, éditer le fichier de configuration
sudo nano /etc/mallouli/agent.env

# Ou avec vim
sudo vi /etc/mallouli/agent.env
```

### 5.2 Paramètres à remplir

```bash
# 🔌 Configuration Backend MallouliAuto
MALLOULI_API_BASE_URL=https://api.mallouliauto.tn  # URL de votre backend
MALLOULI_VEHICLE_ID=1                               # ID du véhicule en base
MALLOULI_DEVICE_ID=ccb71376cd13b201170ec917fc1199ff  # ID du dongle (visible dans AutoPi Cloud)
MALLOULI_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # JWT token du backend

# 🎯 API Locale AutoPi (ne pas modifier sauf si port différent)
AUTOPI_LOCAL_API=http://127.0.0.1:9000
AUTOPI_UNIT_ID_FILE=/etc/salt/minion_id

# ⚙️ Paramètres Agent
PUSH_INTERVAL_SEC=5           # Envoyer toutes les 5 secondes
REQUEST_TIMEOUT_SEC=10        # Timeout HTTP
MAX_RETRIES=3                 # Tentatives en cas d'erreur
RETRY_DELAY_SEC=2             # Délai entre tentatives
LOG_LEVEL=INFO                # DEBUG, INFO, WARNING, ERROR
```

### 5.3 Comment obtenir les paramètres

#### MALLOULI_DEVICE_ID
```bash
# Sur le dongle, lire le unit_id du dongle
cat /etc/salt/minion_id

# Ou via l'API locale
curl http://127.0.0.1:9000/

# Output: {"unit_id": "ccb71376cd13b201170ec917fc1199ff"}
```

#### MALLOULI_API_TOKEN
```bash
# Sur votre backend, générer un JWT token pour l'utilisateur "agent"
# Appel: POST https://api.mallouliauto.tn/api/v1/auth/login
curl -X POST https://api.mallouliauto.tn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@mallouliauto.tn",
    "password": "secure_password"
  }'

# Output: {"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", ...}
# Copier le token complet
```

### 5.4 Tester la configuration

```bash
# Sur le dongle, vérifier que les variables d'env sont chargées
source /etc/mallouli/agent.env
echo $MALLOULI_API_BASE_URL
echo $MALLOULI_API_TOKEN

# Vérifier la connexion au backend
curl -X GET \
  -H "Authorization: Bearer $MALLOULI_API_TOKEN" \
  -H "Content-Type: application/json" \
  $MALLOULI_API_BASE_URL/api/v1/telemetry?vehicle_id=$MALLOULI_VEHICLE_ID&limit=1

# Devrait retourner 200 OK avec des données ou vide
```

---

## 6. VÉRIFICATION ET TESTS

### 6.1 Démarrer le service

```bash
# Démarrer l'agent manuellement (pour tester)
sudo python3 /opt/mallouli/agent/main.py

# Devrait afficher dans les logs:
# 2026-06-22 10:30:00,123 [INFO] === MallouliAuto Dongle Agent démarrage ===
# 2026-06-22 10:30:00,234 [INFO] Backend: https://api.mallouliauto.tn
# 2026-06-22 10:30:00,345 [INFO] Vehicle ID: 1 | Device ID: ccb71376cd13b201170ec917fc1199ff
# 2026-06-22 10:30:01,456 [INFO] unit_id lu depuis /etc/salt/minion_id: ccb71376cd13b201170ec917fc1199ff
# 2026-06-22 10:30:02,567 [INFO] Token Local API AutoPi obtenu
# 2026-06-22 10:30:03,678 [INFO] Donnees OBD: {'speed': 0.0, 'rpm': 0.0, ...}
# 2026-06-22 10:30:04,789 [INFO] Telemetrie envoyee OK [HTTP 201]

# Arrêter avec Ctrl+C
```

### 6.2 Démarrer le service systemd

```bash
# Démarrer le service
sudo systemctl start mallouli-agent

# Vérifier le status
sudo systemctl status mallouli-agent

# Devrait afficher: ● mallouli-agent.service - MallouliAuto Dongle Agent
#                    Loaded: loaded (...; enabled; ...)
#                    Active: active (running) since ...

# Voir les logs en direct
sudo journalctl -u mallouli-agent -f

# Ou lire les logs du fichier
sudo tail -f /var/log/mallouli/agent.log
sudo tail -f /var/log/mallouli/agent.err.log
```

### 6.3 Tester les requêtes OBD

```bash
# Sur le dongle, tester l'API locale AutoPi directement

# 1. Obtenir un token
TOKEN=$(curl -s -X POST http://127.0.0.1:9000/auth/login/ | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"

# 2. Récupérer le unit_id
UNIT_ID=$(cat /etc/salt/minion_id)
echo "Unit ID: $UNIT_ID"

# 3. Exécuter une commande OBD (ex: vitesse)
curl -X POST http://127.0.0.1:9000/dongle/$UNIT_ID/execute/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "obd.query SPEED",
    "arg": [],
    "kwarg": {}
  }'

# Output: {"value": 0.0} ou {"_stamp": 1234567890, "value": 85.5}
```

---

## 7. DÉPANNAGE

### Erreur: "Connection refused" au backend

```bash
# Vérifier la connectivité internet
ping 8.8.8.8

# Vérifier que l'URL du backend est correcte
echo $MALLOULI_API_BASE_URL

# Tester une requête simple
curl -v https://api.mallouliauto.tn

# Si certificat SSL n'est pas reconnu, utiliser -k (non recommandé en production)
```

### Erreur: "Invalid token"

```bash
# Vérifier que le token JWT n'a pas expiré
echo $MALLOULI_API_TOKEN

# Régénérer un nouveau token depuis le backend
curl -X POST https://api.mallouliauto.tn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "...", "password": "..."}'

# Mettre à jour /etc/mallouli/agent.env avec le nouveau token
sudo nano /etc/mallouli/agent.env
```

### Erreur: "Local API not responding"

```bash
# Vérifier que le service AutoPi tourne
sudo systemctl status autopi

# Redémarrer les services AutoPi
sudo systemctl restart autopi

# Vérifier que le port 9000 écoute
sudo netstat -tlnp | grep 9000

# Ou avec ss (plus moderne)
sudo ss -tlnp | grep 9000
```

### Service ne démarre pas

```bash
# Vérifier les erreurs de syntaxe dans le fichier service
sudo systemctl status mallouli-agent -l

# Vérifier la configuration
sudo /usr/bin/python3 /opt/mallouli/agent/main.py

# Vérifier les permissions
ls -la /opt/mallouli/agent/main.py
ls -la /etc/mallouli/agent.env
```

### Voir tous les logs

```bash
# Logs système
sudo journalctl -u mallouli-agent --all

# Logs avec timestamps
sudo journalctl -u mallouli-agent --no-pager -o short-iso

# Logs depuis N minutes
sudo journalctl -u mallouli-agent --since "5 minutes ago"

# Logs des erreurs uniquement
sudo journalctl -u mallouli-agent -p err
```

---

## 8. COMMANDES UTILES

### Gestion du service

```bash
# Démarrer
sudo systemctl start mallouli-agent

# Arrêter
sudo systemctl stop mallouli-agent

# Redémarrer
sudo systemctl restart mallouli-agent

# Recharger la configuration (sans interrompre)
sudo systemctl reload mallouli-agent

# Désactiver au démarrage
sudo systemctl disable mallouli-agent

# Activer au démarrage
sudo systemctl enable mallouli-agent

# Voir les dépendances
systemctl list-dependencies mallouli-agent

# Voir quand il a démarré
systemctl show mallouli-agent -p ActiveEnterTimestamp
```

### Vérifications

```bash
# Est-ce que l'agent tourne ?
pgrep -f "mallouli-agent"
ps aux | grep mallouli-agent

# Logs en direct
sudo journalctl -u mallouli-agent -f

# Voir tout le fichier de log
cat /var/log/mallouli/agent.log | less

# Nombre de lignes dans le log
wc -l /var/log/mallouli/agent.log

# Dernières 100 lignes
tail -n 100 /var/log/mallouli/agent.log

# Chercher une erreur
grep "ERROR" /var/log/mallouli/agent.log
```

### Inspection du dongle

```bash
# Lister les fichiers de config
ls -la /etc/salt/
cat /etc/salt/minion_id

# Vérifier l'API locale AutoPi
curl http://127.0.0.1:9000/
curl -X POST http://127.0.0.1:9000/auth/login/

# Lister les services AutoPi
systemctl list-units --type=service | grep autopi

# Voir la configuration système
cat /etc/autopi/config.json | jq .

# Espace disque disponible
df -h

# Mémoire disponible
free -h

# CPU temp (si disponible)
vcgencmd measure_temp
```

### Nettoyage et maintenance

```bash
# Vider les anciens logs
sudo truncate -s 0 /var/log/mallouli/agent.log
sudo truncate -s 0 /var/log/mallouli/agent.err.log

# Archiver les logs
gzip /var/log/mallouli/agent.log

# Redémarrer complètement
sudo reboot

# Arrêter et hiberner (pour économie d'énergie)
sudo halt
```

---

## RÉSUMÉ : STEPS RAPIDES

```bash
# 1. Se connecter
ssh pi@192.168.1.147

# 2. Copier les fichiers (depuis votre PC)
scp -r opt etc requirements.txt setup-agent.sh pi@192.168.1.147:/tmp/

# 3. Sur le dongle, installer
cd /tmp
sudo bash setup-agent.sh

# 4. Configurer
sudo nano /etc/mallouli/agent.env
# Remplir les paramètres

# 5. Démarrer
sudo systemctl start mallouli-agent

# 6. Vérifier
sudo systemctl status mallouli-agent
sudo journalctl -u mallouli-agent -f
```

---

