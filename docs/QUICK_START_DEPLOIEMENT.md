# 🚀 DÉPLOIEMENT AGENT MALLOULI - QUICK START

**Objectif** : Configurer et lancer l'agent Mallouli sur le dongle AutoPi en 5 minutes

---

## 📋 CHECKLIST PRE-DÉPLOIEMENT

Avant de faire quoi que ce soit, vérifiez :

- [ ] Dongle AutoPi **connecté à un véhicule** (OBD-II port)
- [ ] Dongle **connecté à internet** (WiFi ou 4G)
- [ ] IP du dongle accessible : `192.168.1.147` (ou vérifier avec ARP)
- [ ] Backend MallouliAuto **running** sur cloud
- [ ] Avez un **JWT token valide** du backend

---

## 🔑 OBTENIR LES PARAMÈTRES CONFIGURATION

Avant d'installer, rassemblez ces infos :

### 1. MALLOULI_DEVICE_ID

```bash
# Sur le dongle (via SSH)
ssh pi@192.168.1.147
cat /etc/salt/minion_id

# Copy-paste la valeur (UUID hexadécimal)
# Exemple: ccb71376cd13b201170ec917fc1199ff
```

### 2. MALLOULI_API_TOKEN

```bash
# Sur votre PC, appeler le backend pour obtenir un token
curl -X POST https://api.mallouliauto.tn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@mallouliauto.tn",
    "password": "your_password"
  }'

# Copy-paste le token reçu:
# {"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", ...}
```

### 3. MALLOULI_VEHICLE_ID

```bash
# Vérifier en base backend:
# SELECT id FROM vehicles WHERE device_id = 'YOUR_DEVICE_ID';
# Ou dans le dashboard backend
```

---

## 📦 ÉTAPES D'INSTALLATION

### ÉTAPE 1: Préparer les fichiers sur votre PC

```
dongle-agent/
├── opt/mallouli/agent/main.py        ✅ (amélioré)
├── etc/mallouli/agent.env            ✅ (amélioré)
├── etc/systemd/system/
│   └── mallouli-agent.service        ✅ (existant)
├── requirements.txt                  ✅ (créé)
└── setup-agent.sh                    ✅ (créé)
```

### ÉTAPE 2: Éditer agent.env sur votre PC

```bash
# Éditer: c:\auto diagnostic platform\dongle-agent\etc\mallouli\agent.env

# Remplir les 3 paramètres critiques:
MALLOULI_API_BASE_URL=https://api.mallouliauto.tn
MALLOULI_VEHICLE_ID=1                          # ← À ADAPTER
MALLOULI_DEVICE_ID=ccb71376cd13b201170ec917fc1199ff  # ← À ADAPTER
MALLOULI_API_TOKEN=eyJhbGciOiJIUzI1NiIs...   # ← À ADAPTER
```

### ÉTAPE 3: Copier sur le dongle (via SCP)

```bash
# Sur votre PC (PowerShell ou Git Bash)

# Créer un fichier .tar.gz
tar -czf mallouli-agent.tar.gz \
  -C c:\auto diagnostic platform\dongle-agent \
  opt/ etc/ requirements.txt setup-agent.sh

# Copier sur le dongle
scp mallouli-agent.tar.gz pi@192.168.1.147:/tmp/

# Vérifier la copie
ssh pi@192.168.1.147 "ls -lh /tmp/mallouli-agent.tar.gz"
```

### ÉTAPE 4: Installer sur le dongle (via SSH)

```bash
# Connexion SSH
ssh pi@192.168.1.147

# Aller au /tmp et extraire
cd /tmp
tar -xzf mallouli-agent.tar.gz
ls -la opt/ etc/ setup-agent.sh

# Lancer le script d'installation (avec sudo)
sudo bash setup-agent.sh

# Output attendu:
# ✅ Installation terminée!
# 📝 Prochaines étapes:
#    1. Éditer /etc/mallouli/agent.env avec vos paramètres
#    2. Lancer: sudo systemctl start mallouli-agent
#    3. Vérifier: sudo systemctl status mallouli-agent
```

### ÉTAPE 5: Vérifier que tout est en place

```bash
# Sur le dongle (via SSH)

# Vérifier les fichiers
sudo ls -la /opt/mallouli/agent/
sudo ls -la /etc/mallouli/
sudo ls -la /etc/systemd/system/mallouli-agent.service

# Vérifier les logs (aucun pour le moment)
sudo ls -la /var/log/mallouli/
```

---

## 🎯 LANCER LE SERVICE

### Test manuel (debugging)

```bash
# Exécuter le script en standalone (non-daemon)
sudo python3 /opt/mallouli/agent/main.py

# Devrait afficher:
# 2026-06-22 10:30:00,123 [INFO] === MallouliAuto Dongle Agent démarrage ===
# 2026-06-22 10:30:00,234 [INFO] Backend: https://api.mallouliauto.tn
# 2026-06-22 10:30:00,345 [INFO] Vehicle ID: 1 | Device ID: ...
# 2026-06-22 10:30:01,456 [INFO] ✅ unit_id lu depuis /etc/salt/minion_id: ...
# 2026-06-22 10:30:02,567 [INFO] ✅ Token Local API AutoPi obtenu
# 2026-06-22 10:30:03,678 [INFO] ✅ Telemetrie envoyee OK [HTTP 201]

# Arrêter avec Ctrl+C
```

### Lancer comme service systemd

```bash
# Démarrer
sudo systemctl start mallouli-agent

# Vérifier le status
sudo systemctl status mallouli-agent

# Devrait montrer: ● mallouli-agent.service - MallouliAuto Dongle Agent
#                  Loaded: loaded (...; enabled; ...)
#                  Active: active (running) since ...

# Activer au démarrage du dongle
sudo systemctl enable mallouli-agent

# Voir les logs en direct
sudo journalctl -u mallouli-agent -f
```

---

## ✅ VÉRIFICATION END-TO-END

### 1. Vérifier que l'agent envoie des données

```bash
# Sur le dongle
sudo journalctl -u mallouli-agent -n 20

# Devrait voir:
# ✅ Telemetrie envoyee OK [HTTP 201]
# ✅ Telemetrie envoyee OK [HTTP 201]
# ...toutes les 5 secondes
```

### 2. Vérifier que le backend reçoit les données

```bash
# Sur votre PC
curl -H "Authorization: Bearer $JWT_TOKEN" \
     https://api.mallouliauto.tn/api/v1/telemetry?vehicle_id=1&limit=1

# Devrait retourner les derniers enregistrements:
# {
#   "data": [
#     {
#       "vehicle_id": 1,
#       "device_id": "ccb71376cd13b201170ec917fc1199ff",
#       "speed": 0.0,
#       "rpm": 0.0,
#       "engine_temp": 95.0,
#       "ts": "2026-06-22T10:30:00Z"
#     }
#   ]
# }
```

### 3. Tester une alerte (température critique)

```bash
# Simuler une température critique (ex: 130°C)
# Pour forcer une alerte ENGINE_OVERHEAT

# Le backend devrait créer une alerte automatiquement
curl -H "Authorization: Bearer $JWT_TOKEN" \
     https://api.mallouliauto.tn/api/v1/alerts?vehicle_id=1&status=ACTIVE

# Devrait voir une alerte:
# {
#   "data": [
#     {
#       "id": 1,
#       "type": "ENGINE_OVERHEAT",
#       "severity": "CRITICAL",
#       "vehicle_id": 1,
#       "created_at": "2026-06-22T10:30:00Z"
#     }
#   ]
# }
```

---

## 🔧 COMMANDES DE MAINTENANCE

### Afficher les logs

```bash
# Les 20 dernières lignes
sudo journalctl -u mallouli-agent -n 20

# Logs en direct (suivi)
sudo journalctl -u mallouli-agent -f

# Depuis une heure
sudo journalctl -u mallouli-agent --since "1 hour ago"

# Erreurs uniquement
sudo journalctl -u mallouli-agent -p err
```

### Redémarrer après changement config

```bash
# Éditer la config
sudo nano /etc/mallouli/agent.env

# Redémarrer le service (recharge les variables d'env)
sudo systemctl restart mallouli-agent

# Vérifier que ça remarche
sudo systemctl status mallouli-agent
sudo journalctl -u mallouli-agent -f
```

### Arrêter le service

```bash
# Arrêt
sudo systemctl stop mallouli-agent

# Désactiver au démarrage
sudo systemctl disable mallouli-agent
```

### Logs de démarrage

```bash
# Voir pourquoi le service ne démarre pas
sudo systemctl status mallouli-agent -l

# Ou essayer de lancer manuellement pour voir l'erreur
sudo python3 /opt/mallouli/agent/main.py

# Ou vérifier le fichier config
cat /etc/mallouli/agent.env
```

---

## 🐛 DÉPANNAGE RAPIDE

| Problème | Symptôme | Solution |
|----------|----------|----------|
| **Token expiré** | `❌ HTTP 401` | Régénérer un nouveau token, update `/etc/mallouli/agent.env` |
| **Backend unreachable** | `⚠️  Pas de reseau` | Vérifier internet (ping 8.8.8.8), URL backend |
| **Local API AutoPi inaccessible** | `❌ Connection refused port 9000` | Redémarrer AutoPi: `sudo systemctl restart autopi` |
| **Config invalide** | Service ne démarre pas | Éditer `/etc/mallouli/agent.env`, check token |
| **Permissions insuffisantes** | `Permission denied` | Run avec `sudo systemctl start mallouli-agent` |
| **Disque plein** | Logs disparaissent | `sudo truncate -s 0 /var/log/mallouli/agent.log` |



## ✨ RÉSUMÉ

```bash
# 5 minutes pour une installation complète:

# 1. Copier les fichiers (1 min)
scp -r ... pi@192.168.1.147:/tmp/

# 2. Installer (2 min)
ssh pi@192.168.1.147 "sudo bash /tmp/setup-agent.sh"

# 3. Configurer (1 min)
ssh pi@192.168.1.147 "sudo nano /etc/mallouli/agent.env"
# Remplir les 3 paramètres

# 4. Lancer (30 sec)
ssh pi@192.168.1.147 "sudo systemctl start mallouli-agent"

# 5. Vérifier (30 sec)
ssh pi@192.168.1.147 "sudo systemctl status mallouli-agent"
```
