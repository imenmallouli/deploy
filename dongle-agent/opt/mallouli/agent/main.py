#!/usr/bin/env python3
"""
MallouliAuto Dongle Agent
========================
Fichier: /opt/mallouli/agent/main.py
Exécution: sudo systemctl start mallouli-agent

📋 Rôle:
  Collecte les données OBD depuis le dongle AutoPi via son API locale (port 9000)
  et les envoie en HTTPS vers le backend MallouliAuto (FastAPI).

🔄 Flux:
  1. Lire unit_id depuis /etc/salt/minion_id (identifiant stable du dongle)
  2. Boucle infinie chaque PUSH_INTERVAL_SEC:
     a. Obtenir token JWT auprès de l'API locale AutoPi
     b. Lire les données OBD (RPM, vitesse, carburant, température, batterie...)
     c. Formater en payload JSON
     d. Envoyer POST /api/v1/telemetry au backend (avec retries)
     e. Attendre PUSH_INTERVAL_SEC avant prochaine boucle

📚 Documentation:
  - AutoPi Local API: https://docs.autopi.io/developer_guides/local-api-overview/
  - AutoPi REST API: https://docs.autopi.io/getting_started/api/
  - OBD Commands: https://docs.autopi.io/core/commands/core-commands-obd/

⚠️  IMPORTANT:
  - Lecture SEULE des données OBD (pas de commandes d'écriture)
  - Ne modifie AUCUN fichier AutoPi
  - Configuration via /etc/mallouli/agent.env
  - Logs: journalctl -u mallouli-agent -f

"""

import logging
import os
import sys
import time
from datetime import datetime, timezone

import requests

# ==================================================================
# CONFIGURATION (chargée par systemd depuis /etc/mallouli/agent.env)
# ==================================================================

MALLOULI_API_BASE_URL  = os.environ.get("MALLOULI_API_BASE_URL", "https://api.mallouliauto.tn")
VEHICLE_ID             = int(os.environ.get("MALLOULI_VEHICLE_ID", "1"))
DEVICE_ID              = os.environ.get("MALLOULI_DEVICE_ID", "")
API_TOKEN              = os.environ.get("MALLOULI_API_TOKEN", "")
AUTOPI_LOCAL_API       = os.environ.get("AUTOPI_LOCAL_API", "http://127.0.0.1:9000")
AUTOPI_UNIT_ID_FILE    = os.environ.get("AUTOPI_UNIT_ID_FILE", "/etc/salt/minion_id")
PUSH_INTERVAL          = int(os.environ.get("PUSH_INTERVAL_SEC", "5"))
REQUEST_TIMEOUT        = int(os.environ.get("REQUEST_TIMEOUT_SEC", "10"))
MAX_RETRIES            = int(os.environ.get("MAX_RETRIES", "3"))
RETRY_DELAY            = int(os.environ.get("RETRY_DELAY_SEC", "2"))
LOG_LEVEL              = os.environ.get("LOG_LEVEL", "INFO").upper()

# ==================================================================
# LOGGING
# ==================================================================

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("mallouli-agent")

# Headers pour le backend MallouliAuto (authentification JWT)
MALLOULI_HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
}

# URLs des endpoints backend
TELEMETRY_URL = f"{MALLOULI_API_BASE_URL}/api/v1/telemetry"
DTC_URL       = f"{MALLOULI_API_BASE_URL}/api/v1/dtc"


# ==================================================================
# ÉTAPE 1: LIRE LE UNIT_ID (identifiant stable du dongle)
# ==================================================================

def get_unit_id() -> str:
    """
    Lit le unit_id unique du dongle AutoPi.
    
    Source 1 (fichier): /etc/salt/minion_id
    Source 2 (API): GET http://127.0.0.1:9000/
    
    Returns:
        str: UUID du dongle (ex: "ccb71376cd13b201170ec917fc1199ff")
        ou "" si impossible de lire
    """
    # Source 1: Lire depuis le fichier (plus fiable)
    try:
        with open(AUTOPI_UNIT_ID_FILE, "r") as f:
            uid = f.read().strip()
            log.info("✅ unit_id lu depuis %s: %s", AUTOPI_UNIT_ID_FILE, uid)
            return uid
    except FileNotFoundError:
        log.warning("⚠️  Fichier %s non trouvé", AUTOPI_UNIT_ID_FILE)

    # Source 2: Fallback via API locale AutoPi
    try:
        resp = requests.get(f"{AUTOPI_LOCAL_API}/", timeout=5)
        uid = resp.json().get("unit_id", "")
        log.info("✅ unit_id via Local API: %s", uid)
        return uid
    except Exception as exc:
        log.error("❌ Impossible de lire unit_id: %s", exc)
        return ""


# ==================================================================
# ÉTAPE 2: OBTENIR UN TOKEN LOCAL API AUTOPI
# ==================================================================

def get_local_api_token() -> str:
    """
    Obtient un JWT token auprès de l'API locale AutoPi (port 9000).
    
    Endpoint: POST http://127.0.0.1:9000/auth/login/
    Documentation: https://docs.autopi.io/developer_guides/local-api-overview/
    
    Returns:
        str: JWT token pour les requêtes suivantes
        ou "" si échec
    """
    try:
        resp = requests.post(
            f"{AUTOPI_LOCAL_API}/auth/login/",
            timeout=5,
        )
        resp.raise_for_status()
        token = resp.json().get("token", "")
        if token:
            log.debug("✅ Token Local API AutoPi obtenu")
            return token
        else:
            log.warning("⚠️  Pas de token dans la réponse")
            return ""
    except requests.exceptions.ConnectionError:
        log.error("❌ Impossible de contacter Local API AutoPi (connection refusée)")
        return ""
    except requests.exceptions.Timeout:
        log.error("❌ Timeout lors de la requête auth Local API")
        return ""
    except Exception as exc:
        log.error("❌ Erreur obtention token Local API: %s", exc)
        return ""


# ==================================================================
# ÉTAPE 3: EXÉCUTER LES COMMANDES OBD
# ==================================================================

def execute_obd_command(unit_id: str, local_token: str, obd_command: str) -> float | None:
    """
    Exécute une commande OBD via l'API locale AutoPi.
    
    Endpoint: POST http://127.0.0.1:9000/dongle/<unit_id>/execute/
    
    Exemple de commandes:
      - "obd.query RPM"       → 3000 (tours/minute)
      - "obd.query SPEED"     → 85.5 (km/h)
      - "obd.query FUEL_LEVEL" → 75.0 (%)
      - "obd.battery"         → 13.2 (volts)
      - "obd.query INTAKE_TEMP" → 42.0 (°C)
    
    Documentation:
      https://docs.autopi.io/developer_guides/local-api-overview/
      https://docs.autopi.io/core/commands/core-commands-obd/
    
    Args:
        unit_id: UUID du dongle
        local_token: JWT token de l'API locale
        obd_command: Commande OBD à exécuter (ex: "obd.query RPM")
    
    Returns:
        float: Valeur numérique retournée par la commande
        None: Si la commande a échoué ou retourné null
    """
    url = f"{AUTOPI_LOCAL_API}/dongle/{unit_id}/execute/"
    headers = {
        "Authorization": f"Bearer {local_token}",
        "Content-Type": "application/json",
    }
    body = {
        "command": obd_command,
        "arg": [],
        "kwarg": {},
    }
    
    try:
        resp = requests.post(url, json=body, headers=headers, timeout=5)
        
        if resp.status_code != 200:
            log.debug("⚠️  OBD command %s retourné HTTP %s", obd_command, resp.status_code)
            return None
        
        data = resp.json()
        
        # AutoPi retourne généralement: {"value": 75.0}
        # Ou avec timestamp: {"_stamp": 1234567890, "value": 75.0}
        val = data.get("value")
        if val is not None:
            return float(val)
        
        log.debug("⚠️  OBD command %s : pas de 'value' dans la réponse", obd_command)
        return None
        
    except requests.exceptions.Timeout:
        log.debug("⏱️  Timeout OBD command %s", obd_command)
        return None
    except Exception as exc:
        log.debug("❌ OBD command %s erreur: %s", obd_command, exc)
        return None


def read_obd_data(unit_id: str, local_token: str) -> dict:
    """
    Lit toutes les données OBD importantes via l'API locale AutoPi.
    
    Commandes exécutées:
      - RPM: Tours moteur par minute (0-8000+ typiquement)
      - SPEED: Vitesse du véhicule (km/h)
      - FUEL_LEVEL: Niveau de carburant (%)
      - COOLANT_TEMP: Température du moteur (°C)
      - ENGINE_LOAD: Charge du moteur (%)
      - BATTERY: Tension batterie (volts)
      - INTAKE_TEMP: Température d'admission air (°C)
    
    Returns:
        dict: {"field_name": value, ...}
              Les values manquantes sont None
    """
    # Mapping: nom_champ_backend -> commande_autopi_obd
    obd_map = {
        "speed":           "obd.query SPEED",
        "rpm":             "obd.query RPM",
        "fuel_level":      "obd.query FUEL_LEVEL",
        "engine_temp":     "obd.query COOLANT_TEMP",
        "engine_load":     "obd.query ENGINE_LOAD",
        "battery_voltage": "obd.battery",
        "intake_temp":     "obd.query INTAKE_TEMP",
    }

    data = {}
    for field, cmd in obd_map.items():
        value = execute_obd_command(unit_id, local_token, cmd)
        data[field] = value
        log.debug("%s = %s", field, value)

    return data


# ==================================================================
# ÉTAPE 4: ENVOYER LES DONNÉES AU BACKEND
# ==================================================================

def send_telemetry(obd_data: dict) -> bool:
    """
    Envoie les données OBD au backend MallouliAuto.
    
    Endpoint: POST https://api.mallouliauto.tn/api/v1/telemetry
    Schema: TelemetryIngest (voir backend/app/schemas/telemetry.py)
    
    Implémente les retries avec backoff exponentiel:
      - Tentative 1: immédiate
      - Tentative 2: après 2s
      - Tentative 3: après 4s (2 * 2)
      - Etc.
    
    Tolerances:
      - ConnectionError: réseau temporairement indisponible
      - Timeout: backend lent
      - HTTP 5xx: erreur serveur temporaire
    
    Args:
        obd_data: dict avec les champs OBD (speed, rpm, engine_temp, etc.)
    
    Returns:
        bool: True si succès (HTTP 200-201), False sinon
    """
    # Formater le payload selon le schema TelemetryIngest du backend
    payload = {
        "vehicle_id":      VEHICLE_ID,
        "device_id":       DEVICE_ID,
        "dongle_id":       DEVICE_ID,  # Même valeur pour compatibilité
        "ts":              datetime.now(timezone.utc).isoformat(),
        "speed":           obd_data.get("speed"),
        "rpm":             obd_data.get("rpm"),
        "fuel_level":      obd_data.get("fuel_level"),
        "engine_temp":     obd_data.get("engine_temp"),
        "engine_load":     obd_data.get("engine_load"),
        "battery_voltage": obd_data.get("battery_voltage"),
        "intake_temp":     obd_data.get("intake_temp"),
    }

    # Retries avec backoff exponentiel
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log.debug("Tentative %d/%d: envoi telemetrie", attempt, MAX_RETRIES)
            
            resp = requests.post(
                TELEMETRY_URL,
                json=payload,
                headers=MALLOULI_HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            
            # Succès
            if resp.status_code in (200, 201):
                log.info("✅ Telemetrie envoyee OK [HTTP %s]", resp.status_code)
                return True
            
            # Erreur serveur (retry peut aider)
            if 500 <= resp.status_code < 600:
                log.warning("⚠️  HTTP %s (erreur serveur): %s", 
                           resp.status_code, resp.text[:200])
            # Erreur client (retry inutile)
            elif 400 <= resp.status_code < 500:
                log.error("❌ HTTP %s (erreur client): %s", 
                         resp.status_code, resp.text[:200])
                return False
            else:
                log.warning("⚠️  HTTP %s: %s", resp.status_code, resp.text[:200])
                
        except requests.exceptions.ConnectionError:
            log.warning("⚠️  Tentative %d/%d: pas de reseau vers MallouliAuto", 
                       attempt, MAX_RETRIES)
        except requests.exceptions.Timeout:
            log.warning("⚠️  Tentative %d/%d: timeout (backend lent)", 
                       attempt, MAX_RETRIES)
        except Exception as exc:
            log.error("❌ Erreur envoi tentative %d/%d: %s", attempt, MAX_RETRIES, exc)

        # Attendre avant retry (sauf dernière tentative)
        if attempt < MAX_RETRIES:
            backoff_delay = RETRY_DELAY * attempt  # 2s, 4s, 6s...
            log.debug("⏱️  Attendre %ds avant prochain retry", backoff_delay)
            time.sleep(backoff_delay)

    log.error("❌ Echec envoi telemetrie apres %d tentatives", MAX_RETRIES)
    return False


# ==================================================================
# VALIDATION DE LA CONFIGURATION
# ==================================================================

def validate_config():
    """
    Vérifie que la configuration est complète et valide avant de démarrer.
    
    Raises:
        SystemExit: Si configuration invalide
    """
    errors = []
    
    if not API_TOKEN or API_TOKEN == "CHANGE_MOI_AVEC_TON_JWT_TOKEN":
        errors.append("❌ MALLOULI_API_TOKEN non configuré ou défaut dans /etc/mallouli/agent.env")
    
    if not DEVICE_ID:
        errors.append("❌ MALLOULI_DEVICE_ID non configuré")
    
    if not MALLOULI_API_BASE_URL.startswith(("https://", "http://")):
        errors.append("❌ MALLOULI_API_BASE_URL doit commencer par https:// ou http://")
    
    if not MALLOULI_API_BASE_URL.startswith("https://") and "localhost" not in MALLOULI_API_BASE_URL:
        errors.append("⚠️  MALLOULI_API_BASE_URL devrait utiliser HTTPS en production")
    
    if VEHICLE_ID <= 0:
        errors.append("❌ MALLOULI_VEHICLE_ID doit être > 0")
    
    if PUSH_INTERVAL <= 0:
        errors.append("❌ PUSH_INTERVAL_SEC doit être > 0")
    
    if errors:
        for error in errors:
            log.error(error)
        sys.exit(1)


# ==================================================================
# BOUCLE PRINCIPALE
# ==================================================================

def main():
    """
    Boucle principale de l'agent.
    
    Flux:
    1. Valider la configuration
    2. Lire le unit_id une seule fois (stable)
    3. Boucle infinie:
       a. Obtenir token Local API
       b. Lire les données OBD
       c. Envoyer au backend
       d. Attendre PUSH_INTERVAL_SEC
    """
    
    log.info("=" * 70)
    log.info("🚀 MallouliAuto Dongle Agent démarrage")
    log.info("=" * 70)
    log.info("Backend: %s", MALLOULI_API_BASE_URL)
    log.info("Vehicle ID: %s | Device ID: %s", VEHICLE_ID, DEVICE_ID)
    log.info("Local API AutoPi: %s", AUTOPI_LOCAL_API)
    log.info("Intervalle: %ds | Timeout: %ds | Max Retries: %d", 
             PUSH_INTERVAL, REQUEST_TIMEOUT, MAX_RETRIES)
    log.info("=" * 70)

    # Valider la configuration avant de boucler
    validate_config()

    # Lire le unit_id une seule fois (stable pour tout le cycle de vie du dongle)
    unit_id = get_unit_id()
    if not unit_id:
        log.error("❌ Impossible de lire unit_id, arrêt agent")
        sys.exit(1)

    # Boucle infinie
    cycle = 0
    while True:
        cycle += 1
        try:
            log.debug("📍 Cycle %d/%s début", cycle, "infini")
            
            # Obtenir un token frais auprès de l'API locale AutoPi
            local_token = get_local_api_token()
            if not local_token:
                log.warning("⚠️  Pas de token Local API, cycle %d ignoré", cycle)
                time.sleep(PUSH_INTERVAL)
                continue

            # Lire les données OBD
            obd_data = read_obd_data(unit_id, local_token)
            log.debug("📊 Donnees OBD cycle %d: %s", cycle, obd_data)

            # Envoyer au backend MallouliAuto
            send_telemetry(obd_data)

        except KeyboardInterrupt:
            log.info("🛑 Interruption par utilisateur (Ctrl+C)")
            break
        except Exception as exc:
            log.error("❌ Erreur boucle principale cycle %d: %s", cycle, exc)
            # Continuer la boucle même en cas d'erreur
        finally:
            log.debug("⏱️  Cycle %d attente %ds avant prochain", cycle, PUSH_INTERVAL)
            time.sleep(PUSH_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log.critical("❌ Erreur critique: %s", exc)
        sys.exit(1)
