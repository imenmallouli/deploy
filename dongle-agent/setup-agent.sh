#!/bin/bash
#
# Script d'installation du MallouliAuto Dongle Agent sur Raspberry Pi AutoPi
# Usage: bash setup-agent.sh
#
# Ce script fait les étapes suivantes:
# 1. Crée les répertoires nécessaires
# 2. Copie le script agent
# 3. Installe les dépendances Python
# 4. Copie la configuration
# 5. Installe et démarre le service systemd
#

set -e  # Exit on error

echo "=========================================="
echo "🚀 Installation MallouliAuto Dongle Agent"
echo "=========================================="

# Variables
AGENT_DIR="/opt/mallouli/agent"
CONFIG_DIR="/etc/mallouli"
SERVICE_FILE="/etc/systemd/system/mallouli-agent.service"
LOG_DIR="/var/log/mallouli"

# Vérifier si on est en root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Ce script doit être exécuté en tant que root (sudo)"
   exit 1
fi

echo ""
echo "1️⃣  Créer les répertoires..."
mkdir -p $AGENT_DIR
mkdir -p $CONFIG_DIR
mkdir -p $LOG_DIR
chmod 755 $AGENT_DIR
chmod 755 $CONFIG_DIR
chmod 755 $LOG_DIR

echo ""
echo "2️⃣  Installer les dépendances Python..."
pip3 install --upgrade pip
pip3 install requests==2.31.0

echo ""
echo "3️⃣  Copier le script agent..."
# Le script main.py doit être dans le même répertoire que ce script setup-agent.sh
if [ -f "opt/mallouli/agent/main.py" ]; then
    cp opt/mallouli/agent/main.py $AGENT_DIR/main.py
    chmod +x $AGENT_DIR/main.py
    echo "   ✅ main.py copié"
else
    echo "   ⚠️  main.py non trouvé (sera créé manuellement)"
fi

echo ""
echo "4️⃣  Copier la configuration..."
if [ -f "etc/mallouli/agent.env" ]; then
    cp etc/mallouli/agent.env $CONFIG_DIR/agent.env
    chmod 600 $CONFIG_DIR/agent.env  # Lecture seule pour sécurité
    echo "   ✅ agent.env copié"
    echo "   ⚠️  IMPORTANT: Éditer $CONFIG_DIR/agent.env avec vos paramètres!"
else
    echo "   ⚠️  agent.env non trouvé (sera créé manuellement)"
fi

echo ""
echo "5️⃣  Installer le service systemd..."
if [ -f "etc/systemd/system/mallouli-agent.service" ]; then
    cp etc/systemd/system/mallouli-agent.service $SERVICE_FILE
    chmod 644 $SERVICE_FILE
    echo "   ✅ Service copié"
    
    # Recharger systemd
    systemctl daemon-reload
    echo "   ✅ systemd rechargé"
    
    # Activer le service
    systemctl enable mallouli-agent
    echo "   ✅ Service activé au démarrage"
else
    echo "   ⚠️  Service systemd non trouvé"
fi

echo ""
echo "=========================================="
echo "✅ Installation terminée!"
echo "=========================================="
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Éditer $CONFIG_DIR/agent.env avec vos paramètres"
echo "   2. Lancer: sudo systemctl start mallouli-agent"
echo "   3. Vérifier: sudo systemctl status mallouli-agent"
echo "   4. Logs: journalctl -u mallouli-agent -f"
echo ""
