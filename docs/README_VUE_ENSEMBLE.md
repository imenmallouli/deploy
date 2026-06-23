# 📚 GUIDE DE LECTURE - VUE D'ENSEMBLE COMPLÈTE

**Objectif**: Vous avez maintenant TOUS les fichiers et TOUTE la documentation. Voici l'ordre optimal pour comprendre et déployer.

**État**: ✅ 100% Prêt à déployer

---

## 🎯 ROADMAP DOCUMENTATION

### **Phase 1: Comprendre l'architecture (30 min)**

#### 📖 À lire:
1. **[CONCEPTION_ARCHITECTURE_MAIN_ET_AGENT.md](../docs/CONCEPTION_ARCHITECTURE_MAIN_ET_AGENT.md)** (600+ lignes)
   - **Quoi**: Explication COMPLÈTE du backend FastAPI + agent dongle
   - **Pourquoi**: Comprendre le **pourquoi** et le **comment**
   - **Sections clés**:
     - Section 1: Vue d'ensemble générale
     - Section 2: Backend main.py (FastAPI)
     - Section 3: Agent Mallouli (dongle)
     - Section 4: Architecture flux de données
   - **Temps**: 20 min (lire sections 1-3)
   - **Résultat**: Vous comprenez le système complet

2. **[STRUCTURE_FICHIERS_AGENT.md](../docs/STRUCTURE_FICHIERS_AGENT.md)** (400+ lignes)
   - **Quoi**: Où vont les fichiers, comment ils interagissent
   - **Sections clés**:
     - Vue globale (diagramme ASCII)
     - Fichiers détaillés (main.py, agent.env, service, etc.)
     - Flux de données
     - Intégration système
   - **Temps**: 10 min
   - **Résultat**: Vous savez où vont les fichiers et pourquoi

---

### **Phase 2: Préparer le déploiement (10 min)**

#### 📖 À lire:
3. **[QUICK_START_DEPLOIEMENT.md](../docs/QUICK_START_DEPLOIEMENT.md)** (300+ lignes)
   - **Quoi**: Checklist rapide pour déployer en 5 min
   - **Sections clés**:
     - Checklist pré-déploiement
     - Comment obtenir les paramètres (DEVICE_ID, TOKEN, etc.)
     - 5 étapes d'installation
     - Vérification end-to-end
   - **Temps**: 5 min (lire + appliquer)
   - **Résultat**: Vous êtes prêt à déployer

#### 📖 À consulter:
4. **[GUIDE_INSTALLATION_SSH_DONGLE.md](../docs/GUIDE_INSTALLATION_SSH_DONGLE.md)** (500+ lignes)
   - **Quoi**: Guide DÉTAILLÉ SSH + installation
   - **Sections clés**:
     - Prérequis
     - Connexion SSH
     - Copie des fichiers (SCP)
     - Installation + vérification
     - Dépannage
   - **Temps**: À consulter au besoin (15 min si vous lisez tout)
   - **Résultat**: Référence pour déboguer les problèmes SSH

---

### **Phase 3: Déployer et tester (20-30 min)**

#### Actions:
1. **Préparer les fichiers** (5 min)
   ```bash
   # Sur votre PC
   # Fichiers présents dans c:\auto diagnostic platform\dongle-agent\
   # Éditer: etc/mallouli/agent.env avec vos paramètres
   ```

2. **Copier sur le dongle** (5 min)
   ```bash
   # Via SCP
   scp -r ... pi@192.168.1.147:/tmp/
   ```

3. **Installer** (5 min)
   ```bash
   # Via SSH + script setup
   ssh pi@192.168.1.147 "sudo bash /tmp/setup-agent.sh"
   ```

4. **Configurer** (5 min)
   ```bash
   # Éditer la config sur le dongle
   ssh pi@192.168.1.147 "sudo nano /etc/mallouli/agent.env"
   ```

5. **Tester** (5-10 min)
   ```bash
   # Démarrer et vérifier
   ssh pi@192.168.1.147 "sudo systemctl start mallouli-agent"
   ssh pi@192.168.1.147 "sudo journalctl -u mallouli-agent -f"
   ```

---

## 📂 FICHIERS CRÉÉS/MODIFIÉS

### Créés pour vous:

| Fichier | Localisation | But |
|---------|-------------|-----|
| **main.py (amélioré)** | `dongle-agent/opt/mallouli/agent/` | Agent avec 200+ lignes de comments |
| **agent.env (amélioré)** | `dongle-agent/etc/mallouli/` | Config détaillée avec explications |
| **requirements.txt** | `dongle-agent/` | Dépendances Python (requests) |
| **setup-agent.sh** | `dongle-agent/` | Script auto-installation |
| **CONCEPTION_ARCHITECTURE_MAIN_ET_AGENT.md** | `docs/` | **← Lire en PREMIER** |
| **GUIDE_INSTALLATION_SSH_DONGLE.md** | `docs/` | Guide détaillé SSH |
| **QUICK_START_DEPLOIEMENT.md** | `docs/` | Checklist rapide |
| **STRUCTURE_FICHIERS_AGENT.md** | `docs/` | Vue d'ensemble architecture |

### Déjà existants (non touchés):

| Fichier | But |
|---------|-----|
| `mallouli-agent.service` | Service systemd (existant) |
| `connect_to_dongle.py` | SSH debug tool (existant) |

---

## 🚀 RÉSUMÉ ÉTAPES RAPIDES

```
┌─────────────────────────────────────────────────────────────┐
│                    SEMAINE 1                                 │
├─────────────────────────────────────────────────────────────┤
│ JOUR 1 (30 min)                                             │
│ □ Lire CONCEPTION_ARCHITECTURE (20 min)                     │
│ □ Lire STRUCTURE_FICHIERS (10 min)                          │
│ → Vous comprenez le système                                  │
│                                                              │
│ JOUR 2 (30 min)                                             │
│ □ Lire QUICK_START (10 min)                                 │
│ □ Préparer les fichiers (5 min)                             │
│ □ Éditer agent.env sur PC (10 min)                          │
│ □ Copier sur dongle (5 min)                                 │
│ → Fichiers prêts sur le dongle                               │
│                                                              │
│ JOUR 3 (15 min)                                             │
│ □ SSH sur dongle                                             │
│ □ Lancer setup-agent.sh                                      │
│ □ Éditer agent.env sur dongle                                │
│ □ Lancer le service                                          │
│ □ Vérifier les logs                                          │
│ → Agent en production!                                       │
│                                                              │
│ JOUR 4-5 (monitoring)                                        │
│ □ Vérifier que les données arrivent au backend              │
│ □ Configurer alertes si nécessaire                          │
│ → Système stable                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎓 APPRENTISSAGE PROGRESSIF

Si vous n'avez **jamais utilisé SSH** ou **systemd**, voici l'ordre enrichi:

```
NOOB FRIENDLY ROADMAP:

1. Lire AutoPi Local API doc (10 min)
   https://docs.autopi.io/developer_guides/local-api-overview/
   → Comprendre le port 9000 et comment communiquer

2. Lire SSH basics (15 min)
   https://docs.autopi.io/developer_guides/how-to-ssh-to-your-device/
   → Pouvoir se connecter au dongle

3. Lire CONCEPTION_ARCHITECTURE (20 min)
   → Comprendre main.py + agent

4. Lire STRUCTURE_FICHIERS (10 min)
   → Comprendre où vont les fichiers

5. Lire QUICK_START (10 min)
   → Plan d'action

6. Suivre GUIDE_INSTALLATION_SSH_DONGLE (20 min)
   → Déployer pas à pas

TOTAL: ~1h30 pour devenir expert!
```

---

## 📞 RESSOURCES OFFICIELLES IMPORTANTES

### AutoPi Documentation:

- 🔗 **Local API**: https://docs.autopi.io/developer_guides/local-api-overview/
  - Comment communiquer avec le port 9000
  - Authentification
  - Exécution des commandes OBD

- 🔗 **REST API**: https://docs.autopi.io/getting_started/api/
  - Authentification JWT vs APIToken
  - Exemples Python/Postman
  - OBD query syntax

- 🔗 **OBD Commands**: https://docs.autopi.io/core/commands/core-commands-obd/
  - Liste complète des commandes (RPM, SPEED, etc.)
  - Paramètres avancés

- 🔗 **SSH Access**: https://docs.autopi.io/developer_guides/how-to-ssh-to-your-device/
  - Comment se connecter au dongle

---

## ✅ AVANT DE LANCER

### Checklist Préalable:

- [ ] Dongle AutoPi **physiquement** connecté au véhicule
- [ ] Dongle **connecté à internet** (WiFi ou 4G)
- [ ] Vous avez l'**IP du dongle** (192.168.1.147)
- [ ] Vous pouvez **pinger** le dongle: `ping 192.168.1.147`
- [ ] **SSH fonctionne**: `ssh pi@192.168.1.147`
- [ ] **Backend Mallouli** est running
- [ ] Vous avez un **JWT token valide** du backend
- [ ] Vous connaissez le **DEVICE_ID** du dongle

### Checklist Configuration:

- [ ] Fichier `agent.env` **ÉDITÉ** avec:
  - [ ] `MALLOULI_API_BASE_URL` = votre backend URL
  - [ ] `MALLOULI_VEHICLE_ID` = ID du véhicule
  - [ ] `MALLOULI_DEVICE_ID` = UUID du dongle
  - [ ] `MALLOULI_API_TOKEN` = JWT token valide

---

## 🐛 SI QUELQUE CHOSE VA MAL

### Erreur Common:

| Erreur | Cause | Solution |
|--------|-------|----------|
| `❌ HTTP 401` | Token expiré | Régénérer token, update `agent.env` |
| `⚠️  Pas de reseau` | Internet down | `ping 8.8.8.8` sur le dongle |
| `Connection refused 9000` | AutoPi API down | `sudo systemctl restart autopi` |
| `❌ Configuration invalide` | Config mal complétée | Vérifier `agent.env` line by line |
| `Permission denied` | Permissions insuffisantes | Utiliser `sudo` |

### Debug Steps:

```bash
# 1. Vérifier que le service tourne
sudo systemctl status mallouli-agent

# 2. Voir les erreurs
sudo journalctl -u mallouli-agent -n 50

# 3. Tester manuellement
sudo python3 /opt/mallouli/agent/main.py

# 4. Tester la config
source /etc/mallouli/agent.env
echo $MALLOULI_API_BASE_URL

# 5. Tester Local API
curl -X POST http://127.0.0.1:9000/auth/login/
```

### Où chercher de l'aide:

1. **Logs du service**: `sudo journalctl -u mallouli-agent -f`
2. **Logs du fichier**: `cat /var/log/mallouli/agent.log`
3. **Documentation**: [GUIDE_INSTALLATION_SSH_DONGLE.md](../docs/GUIDE_INSTALLATION_SSH_DONGLE.md) (section 7: Dépannage)
4. **Support AutoPi**: https://docs.autopi.io/

---

## 📊 RÉSUMÉ FICHIERS CRÉÉS

### Pour votre PC (à copier sur dongle):

```
c:\auto diagnostic platform\dongle-agent\
├── opt/mallouli/agent/
│   └── main.py ✅ [CRÉÉ/AMÉLIORÉ]
├── etc/mallouli/
│   └── agent.env ✅ [CRÉÉ/AMÉLIORÉ]
├── etc/systemd/system/
│   └── mallouli-agent.service ✅ [EXISTANT]
├── requirements.txt ✅ [CRÉÉ]
└── setup-agent.sh ✅ [CRÉÉ]
```

### Pour votre documentation:

```
c:\auto diagnostic platform\docs\
├── CONCEPTION_ARCHITECTURE_MAIN_ET_AGENT.md ✅ [CRÉÉ]
├── STRUCTURE_FICHIERS_AGENT.md ✅ [CRÉÉ]
├── QUICK_START_DEPLOIEMENT.md ✅ [CRÉÉ]
├── GUIDE_INSTALLATION_SSH_DONGLE.md ✅ [CRÉÉ]
└── README_VUE_ENSEMBLE.md ✅ [CE FICHIER]
```

---

## 🎉 PROCHAINES ÉTAPES

### Après que tout fonctionne:

1. **Monitoring** (facultatif):
   - Configurer alertes systemd
   - Monitoring des logs (`tail -f`)
   - Monitoring des données du backend

2. **Optimisation** (facultatif):
   - Ajuster `PUSH_INTERVAL_SEC` selon latence/charge
   - Configurer rotation des logs
   - Ajouter d'autres capteurs OBD

3. **Production** (important):
   - Changer mot de passe SSH du dongle
   - Générer new JWT tokens régulièrement
   - Backup de la config `/etc/mallouli/agent.env`
   - Monitoring du uptime du service

---

## 💡 BONNES PRATIQUES

```
✅ À FAIRE:
- Utiliser systemed pour le service (auto-restart)
- Stocker la config dans /etc/mallouli/
- Vérifier les logs régulièrement
- Renouveler JWT tokens tous les 3 mois
- Garder agent.env en dehors de Git (secrets!)

❌ À ÉVITER:
- Modifier les fichiers AutoPi
- Committer le JWT token dans Git
- Laisser le mot de passe SSH par défaut
- Ignorer les erreurs de logs
- Utiliser des commandes OBD non-read-only
```

---

**Vous êtes maintenant prêt à déployer l'agent Mallouli! 🚀**

Commencez par lire **[CONCEPTION_ARCHITECTURE_MAIN_ET_AGENT.md](../docs/CONCEPTION_ARCHITECTURE_MAIN_ET_AGENT.md)**, puis suivez **[QUICK_START_DEPLOIEMENT.md](../docs/QUICK_START_DEPLOIEMENT.md)**.

Bonne chance ! 💪
