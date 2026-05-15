"""
generate_sample_dataset.py
Génère un fichier Excel de démonstration avec des données réalistes
correspondant exactement au schéma backend de la plateforme Auto Diagnostic.

Sheets:
    1. telemetry_data  — mesures OBD + système (temp_cpu/cpu/gpu) par véhicule sur 7 jours
  2. dtc_records     — codes de défaut DTC enregistrés
  3. iot_logs        — logs événements device AutoPi
  4. ai_labels       — étiquettes IA / Risk Score dérivés des règles métier

Usage:
    python backend/scripts/generate_sample_dataset.py
Output:
    backend/data/sample_dataset.xlsx
"""

import os
import re
import random
from datetime import datetime, timedelta
from html import unescape

import pandas as pd

# ── Configuration ──────────────────────────────────────────────────────────────
RANDOM_SEED = 42
random.seed(RANDOM_SEED)

OUTPUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "sample_dataset.xlsx")

# Véhicules de la flotte
VEHICLES = [
    {
        "vehicle_id": 1,
        "plate": "TUN-001",
        "model": "Toyota Corolla 2020",
        "device_id": "c917fc1199ff",
        "driving_style": "balanced",
        "battery_health": 1.00,
        "cooling_efficiency": 1.00,
    },
    {
        "vehicle_id": 2,
        "plate": "TUN-002",
        "model": "Volkswagen Golf 2019",
        "device_id": "a1b2c3d4e5f6",
        "driving_style": "aggressive",
        "battery_health": 0.96,
        "cooling_efficiency": 0.94,
    },
    {
        "vehicle_id": 3,
        "plate": "TUN-003",
        "model": "Renault Clio 2021",
        "device_id": "bbccdd001122",
        "driving_style": "urban",
        "battery_health": 0.98,
        "cooling_efficiency": 1.04,
    },
    # Véhicules dégradés — batterie et refroidissement défaillants → générateurs de critiques
    {
        "vehicle_id": 4,
        "plate": "TUN-004",
        "model": "Peugeot 308 2017",
        "device_id": "ff00aa112233",
        "driving_style": "aggressive",
        "battery_health": 0.82,   # batterie très usée
        "cooling_efficiency": 0.76,  # refroidissement défaillant
    },
    {
        "vehicle_id": 5,
        "plate": "TUN-005",
        "model": "Ford Focus 2016",
        "device_id": "cc44bb667788",
        "driving_style": "aggressive",
        "battery_health": 0.78,   # batterie critique
        "cooling_efficiency": 0.80,  # radiateur dégradé
    },
]

START_DATE   = datetime(2026, 3, 25, 6, 0, 0)
INTERVAL_MIN = 5          # une mesure toutes les 5 minutes
DAYS         = 7          # 7 jours de données
ROWS_PER_VEH = (DAYS * 24 * 60) // INTERVAL_MIN   # ~2016 lignes / véhicule

# Cible de distribution pour le sheet ai_labels:
# info=2000, warning=2000, critical=2000 (total 6000 lignes).
TARGET_INFO_COUNT = 2000
TARGET_WARNING_COUNT = 2000
TARGET_CRITICAL_COUNT = 2000
AI_LABELS_TARGET_ROWS = TARGET_INFO_COUNT + TARGET_WARNING_COUNT + TARGET_CRITICAL_COUNT


# ── Helpers ────────────────────────────────────────────────────────────────────

def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))

def gen_timestamp_series(n: int, start: datetime, step_min: int):
    return [start + timedelta(minutes=i * step_min) for i in range(n)]


# ── Sheet 1 — telemetry_data ───────────────────────────────────────────────────

def gen_telemetry():
    rows = []
    for veh in VEHICLES:
        ts_list = gen_timestamp_series(ROWS_PER_VEH, START_DATE, INTERVAL_MIN)
        odometer = 120_000.0 + random.uniform(0, 500)
        fuel_level = random.uniform(55, 92)
        engine_temp = random.uniform(18, 24)

        style = veh.get("driving_style", "balanced")
        speed_bias = {"urban": -4, "balanced": 0, "aggressive": 10}.get(style, 0)
        rpm_bias = {"urban": 0, "balanced": 80, "aggressive": 260}.get(style, 0)
        battery_health = veh.get("battery_health", 1.0)
        cooling_efficiency = veh.get("cooling_efficiency", 1.0)

        for ts in ts_list:
            hour = ts.hour
            weekday = ts.weekday()
            weekend = weekday >= 5

            rush_hour = 7 <= hour <= 9 or 17 <= hour <= 20
            lunch_window = 12 <= hour <= 13
            night = hour >= 22 or hour <= 5
            heat_wave = weekday in {1, 3}

            traffic_jam = rush_hour and random.random() < 0.35
            steep_climb = 8 <= hour <= 18 and random.random() < 0.08
            heavy_load_trip = random.random() < 0.05

            if night:
                mode = "idle"
            elif traffic_jam:
                mode = "stop_go"
            elif rush_hour:
                mode = "urban"
            elif lunch_window or weekend:
                mode = random.choice(["suburban", "highway", "idle"])
            else:
                mode = random.choice(["suburban", "highway", "urban"])

            speed_ranges = {
                "idle": (0, 4),
                "stop_go": (0, 25),
                "urban": (15, 60),
                "suburban": (40, 85),
                "highway": (75, 120),
            }
            speed = random.uniform(*speed_ranges[mode]) + speed_bias + random.uniform(-4, 4)
            speed = clamp(speed, 0, 140)

            base_rpm = 650 if speed < 5 else speed * (23 if mode == "highway" else 26) + rpm_bias
            if steep_climb:
                base_rpm += 380
            if heavy_load_trip:
                base_rpm += 260
            rpm = int(clamp(base_rpm + random.uniform(-220, 220), 600, 5200))

            day_heat = 6 * max(0, 1 - abs(hour - 14) / 8)
            ambient_air_temp = 17 + day_heat + (4 if heat_wave else 0) + random.uniform(-2.5, 2.5)
            ambient_air_temp = round(clamp(ambient_air_temp, 8, 38), 1)

            engine_load = 18 + speed * 0.5 + (10 if steep_climb else 0) + (8 if heavy_load_trip else 0)
            engine_load += (6 if mode == "stop_go" else 0) + random.uniform(-8, 8)
            engine_load = clamp(engine_load, 5, 98)

            temp_gain = (engine_load / 100) * 2.2 + (0.8 if mode in {"urban", "stop_go"} else 0.3)
            temp_gain += 1.2 if heat_wave else 0
            temp_loss = 1.4 if mode == "idle" else 0.3
            engine_temp = clamp(
                engine_temp + (temp_gain / cooling_efficiency) - temp_loss + random.uniform(-0.4, 0.6),
                ambient_air_temp - 2,
                112,
            )
            if speed > 70 and not steep_climb:
                engine_temp = max(engine_temp - random.uniform(0, 0.5), ambient_air_temp + 8)

            battery_base = 12.0 * battery_health + (1.2 if speed > 5 else 0.3) + (0.15 if mode == "highway" else 0)
            if traffic_jam:
                battery_base -= 0.25
            if heavy_load_trip:
                battery_base -= 0.10
            battery_voltage = round(clamp(battery_base + random.uniform(-0.18, 0.18), 10.7, 14.6), 2)

            intake_temp = round(clamp(ambient_air_temp + 3 + engine_load * 0.06 + random.uniform(-1.5, 1.5), 10, 55), 1)

            # Device-level metrics (AutoPi-like): CPU temperature + CPU/GPU usage
            temp_cpu = round(clamp(43 + ambient_air_temp * 0.22 + engine_load * 0.10 + random.uniform(-3.0, 3.0), 35, 94), 1)
            cpu = round(clamp(18 + (speed * 0.14) + (6 if traffic_jam else 0) + random.uniform(-8, 8), 2, 98), 1)
            gpu = round(clamp(14 + (cpu * 0.58) + random.uniform(-10, 10), 1, 95), 1)

            fuel_burn = 0.0035 + speed * 0.00022 + engine_load * 0.00016 + (0.003 if mode == "stop_go" else 0)
            fuel_level = clamp(fuel_level - fuel_burn, 0, 100)
            odometer += speed * (INTERVAL_MIN / 60)

            rows.append({
                "vehicle_id": veh["vehicle_id"],
                "plate": veh["plate"],
                "device_id": veh["device_id"],
                "ts": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "speed": round(speed, 1),
                "rpm": rpm,
                "fuel_level": round(fuel_level, 2),
                "engine_temp": round(engine_temp, 1),
                "battery_voltage": battery_voltage,
                "engine_load": round(engine_load, 1),
                "ambient_air_temp": ambient_air_temp,
                "intake_temp": intake_temp,
                "odometer": round(odometer, 1),
                "temp_cpu": temp_cpu,
                "cpu": cpu,
                "gpu": gpu,
            })

    # Injecter un mélange de cas faibles, modérés et critiques (anomalies simples)
    for row in random.sample(rows, k=145):
        anomaly = random.choice([
            "battery_warning",
            "low_battery",
            "engine_hot",
            "overheat",
            "low_fuel",
            "high_rpm",
            "overload",
        ])
        if anomaly == "battery_warning":
            row["battery_voltage"] = round(random.uniform(11.7, 12.15), 2)
        elif anomaly == "low_battery":
            row["battery_voltage"] = round(random.uniform(10.5, 11.4), 2)
        elif anomaly == "engine_hot":
            row["engine_temp"] = round(random.uniform(96, 103), 1)
        elif anomaly == "overheat":
            row["engine_temp"] = round(random.uniform(104, 115), 1)
        elif anomaly == "low_fuel":
            row["fuel_level"] = round(random.uniform(2, 14), 2)
        elif anomaly == "high_rpm":
            row["rpm"] = random.randint(3900, 5500)
        elif anomaly == "overload":
            row["engine_load"] = round(random.uniform(80, 96), 1)

    # ── Combos multi-anomalies garantissant un score critique ────────────────
    # batterie_critique + surchauffe → score > 50 assuré
    for row in random.sample(rows, k=140):
        combo = random.choice([
            "battery_overheat",       # batterie < 11.3 + temp > 106
            "battery_overheat_load",  # batterie + temp + surcharge
            "total_critical",         # tout rouge simultanément
            "overheat_overload",      # temp > 106 + load > 88 + rpm élevé
            "battery_fuel_highway",   # batterie faible + carbu vide + haute vitesse
            "battery_overvoltage",    # surtension > 15.8V
            "alternator_weak",        # alternateur défaillant : 12.0-12.4V moteur allumé
        ])
        if combo == "battery_overheat":
            row["battery_voltage"] = round(random.uniform(10.5, 11.3), 2)
            row["engine_temp"]     = round(random.uniform(105, 115), 1)
        elif combo == "battery_overheat_load":
            row["battery_voltage"] = round(random.uniform(10.5, 11.4), 2)
            row["engine_temp"]     = round(random.uniform(104, 115), 1)
            row["engine_load"]     = round(random.uniform(86, 97), 1)
        elif combo == "total_critical":
            row["battery_voltage"] = round(random.uniform(10.2, 11.2), 2)
            row["engine_temp"]     = round(random.uniform(106, 118), 1)
            row["fuel_level"]      = round(random.uniform(1, 6), 2)
            row["rpm"]             = random.randint(4500, 6000)
            row["engine_load"]     = round(random.uniform(85, 98), 1)
        elif combo == "overheat_overload":
            row["engine_temp"]     = round(random.uniform(105, 115), 1)
            row["engine_load"]     = round(random.uniform(88, 98), 1)
            row["rpm"]             = random.randint(4200, 5500)
        elif combo == "battery_fuel_highway":
            row["battery_voltage"] = round(random.uniform(10.6, 11.4), 2)
            row["fuel_level"]      = round(random.uniform(1, 5), 2)
            row["speed"]           = round(random.uniform(88, 130), 1)
        elif combo == "battery_overvoltage":
            row["battery_voltage"] = round(random.uniform(15.8, 16.4), 2)
            row["rpm"]             = random.randint(4000, 5200)
        elif combo == "alternator_weak":
            # Moteur allumé (rpm > 1000) mais tension trop basse
            row["battery_voltage"] = round(random.uniform(12.0, 12.4), 2)
            row["rpm"]             = random.randint(1200, 3500)
            row["speed"]           = round(random.uniform(30, 120), 1)

    return pd.DataFrame(rows)


# ── Sheet 2 — dtc_records ──────────────────────────────────────────────────────

DTC_CATALOG = [
    ("P0300", "Ratés d'allumage détectés (cylindres multiples)",              "critical"),
    ("P0420", "Efficacité du catalyseur sous le seuil — Banc 1",              "warning"),
    ("P0171", "Mélange trop pauvre — Banc 1",                                 "warning"),
    ("P0101", "Capteur MAF — valeur hors plage",                              "warning"),
    ("P0113", "Capteur température air admission — circuit ouvert/haut",      "warning"),
    ("P0115", "Capteur température liquide refroidissement — dysfonctionnement","warning"),
    ("P0562", "Tension système faible",                                       "critical"),
    ("P0401", "Débit EGR insuffisant",                                        "info"),
    ("P0455", "Fuite EVAP — grosse fuite détectée",                           "info"),
    ("P0217", "Température moteur trop élevée",                               "critical"),
    ("P0500", "Capteur vitesse véhicule défaillant",                          "warning"),
    ("P0605", "ROM du calculateur moteur — erreur interne",                   "critical"),
]

DTC_SOURCE_BASE_URL = "https://www.outilsobdfacile.fr/code-defaut-standard-obd.php?dtc={range_key}#dtc"
DTC_SOURCE_RANGES = [
    "p0000-p0299",
    "p0300-p0399",
    "p0400-p0499",
    "p0500-p0599",
    "p0600-p0699",
    "p0700-p0999",
]


def infer_dtc_severity(code: str, description: str) -> str:
    text = f"{code} {description}".lower()
    critical_tokens = [
        "surchauffe",
        "trop élevée",
        "trop haute",
        "pression .* trop haute",
        "tension système faible",
        "erreur interne",
        "ratés d'allumage",
        "régime excessif",
        "vitesse excessive",
    ]
    warning_tokens = [
        "hors plage",
        "problème de performance",
        "circuit intermittent",
        "signal haut",
        "signal bas",
        "fuite",
        "capteur",
        "efficacité",
    ]

    for token in critical_tokens:
        if re.search(token, text):
            return "critical"
    for token in warning_tokens:
        if re.search(token, text):
            return "warning"
    return "info"


def fetch_remote_dtc_catalog() -> list[tuple[str, str, str]]:
    """Fetch DTC codes from source website ranges and infer severity.

    Returns list of tuples: (code, description, severity)
    """
    catalog_map: dict[str, tuple[str, str]] = {}

    try:
        import requests
    except Exception:
        return []

    row_re = re.compile(
        r"<tr>\s*<td>\s*([PCBU][0-9A-F]{4})\s*</td>\s*<td>(.*?)</td>\s*</tr>",
        flags=re.IGNORECASE | re.DOTALL,
    )

    for range_key in DTC_SOURCE_RANGES:
        url = DTC_SOURCE_BASE_URL.format(range_key=range_key)
        try:
            resp = requests.get(
                url,
                timeout=25,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ADP-DTC-Builder/1.0)"},
            )
            html_text = resp.text
        except Exception:
            continue

        for code, desc_html in row_re.findall(html_text):
            code = str(code).strip().upper()
            desc = re.sub(r"<[^>]+>", "", str(desc_html))
            desc = unescape(desc).strip()
            if not re.fullmatch(r"[PCBU][0-9A-F]{4}", code):
                continue
            if not desc:
                continue
            if code not in catalog_map:
                catalog_map[code] = (desc, infer_dtc_severity(code, desc))

    # Keep deterministic ordering by code
    return [(code, desc, sev) for code, (desc, sev) in sorted(catalog_map.items(), key=lambda x: x[0])]


def get_dtc_catalog() -> list[tuple[str, str, str]]:
    remote_catalog = fetch_remote_dtc_catalog()
    if remote_catalog:
        return remote_catalog
    return DTC_CATALOG

DTC_BY_VEHICLE_PROFILE = {
    "TUN-001": ["P0217", "P0562", "P0605", "P0101", "P0171", "P0401", "P0455"],
    "TUN-002": ["P0115", "P0101", "P0171", "P0500", "P0113", "P0455"],
    "TUN-003": ["P0300", "P0562", "P0401", "P0500", "P0420", "P0455"],
}

def gen_dtc():
    rows = []
    dtc_catalog = get_dtc_catalog()
    catalog_map = {code: (desc, severity) for code, desc, severity in dtc_catalog}
    used_codes: set[str] = set()
    for veh in VEHICLES:
        forced_codes = DTC_BY_VEHICLE_PROFILE.get(veh["plate"], [])
        if forced_codes:
            sample = [
                (code, catalog_map.get(code, ("Code défaut OBD-II détecté", "warning"))[0], catalog_map.get(code, ("", "warning"))[1])
                for code in forced_codes
            ]
        else:
            pool = dtc_catalog if len(dtc_catalog) >= 7 else DTC_CATALOG
            sample = random.sample(pool, k=random.randint(3, min(10, len(pool))))

        for code, desc, severity in sample:
            used_codes.add(code)
            first   = START_DATE + timedelta(days=random.randint(0, 4),  hours=random.randint(0, 23))
            last    = first + timedelta(hours=random.randint(1, 48))
            resolved = random.choice([True, False, False])   # 33% résolus
            rows.append({
                "vehicle_id"      : veh["vehicle_id"],
                "plate"           : veh["plate"],
                "code"            : code,
                "description"     : desc,
                "severity"        : severity,
                "first_detected"  : first.strftime("%Y-%m-%d %H:%M:%S"),
                "last_occurrence" : last.strftime("%Y-%m-%d %H:%M:%S"),
                "resolved"        : resolved,
                "occurrences"     : random.randint(1, 25),
            })

    # Guarantee full catalog coverage: every known DTC appears at least once.
    all_codes = [code for code, _, _ in dtc_catalog]
    missing_codes = [code for code in all_codes if code not in used_codes]
    for code in missing_codes:
        desc, severity = catalog_map.get(code, ("Code défaut OBD-II détecté", "warning"))
        veh = random.choice(VEHICLES)
        first = START_DATE + timedelta(days=random.randint(0, DAYS - 1), hours=random.randint(0, 23))
        last = first + timedelta(hours=random.randint(1, 24))
        rows.append(
            {
                "vehicle_id": veh["vehicle_id"],
                "plate": veh["plate"],
                "code": code,
                "description": desc,
                "severity": severity,
                "first_detected": first.strftime("%Y-%m-%d %H:%M:%S"),
                "last_occurrence": last.strftime("%Y-%m-%d %H:%M:%S"),
                "resolved": random.choice([True, False]),
                "occurrences": random.randint(1, 5),
            }
        )
    return pd.DataFrame(rows)


# ── Sheet 3 — iot_logs ─────────────────────────────────────────────────────────

EVENT_TYPES = [
    ("ignition_on",  "info",    "Moteur démarré — tension={:.1f}V"),
    ("ignition_off", "info",    "Moteur arrêté — kilométrage={:.1f} km"),
    ("overspeed",    "warning", "Vitesse dépassée : {:.1f} km/h (limite 90)"),
    ("dtc_detected", "error",   "Code défaut détecté : {}"),
    ("low_battery",  "warning", "Tension batterie basse : {:.2f}V"),
    ("geofence_exit","warning", "Sortie zone autorisée — position GPS enregistrée"),
    ("connection",   "info",    "Device connecté au broker MQTT"),
    ("sync_ok",      "info",    "Synchronisation Cloud AutoPi réussie"),
    ("overheat",     "error",   "Surchauffe moteur : {:.1f}°C"),
]

def gen_iot_logs():
    rows = []
    for veh in VEHICLES:
        n = random.randint(60, 90)
        for _ in range(n):
            evt_type, level, msg_tpl = random.choice(EVENT_TYPES)
            ts = START_DATE + timedelta(
                days=random.randint(0, DAYS - 1),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
            # Remplacer le placeholder du message
            if "{:.1f}V" in msg_tpl:
                message = msg_tpl.format(random.uniform(11.5, 14.4))
            elif "{:.1f} km" in msg_tpl:
                message = msg_tpl.format(random.uniform(120000, 125000))
            elif "{:.1f} km/h" in msg_tpl:
                message = msg_tpl.format(random.uniform(91, 130))
            elif "défaut" in msg_tpl:
                message = msg_tpl.format(random.choice(["P0300", "P0420", "P0171"]))
            elif "{:.2f}V" in msg_tpl:
                message = msg_tpl.format(random.uniform(10.5, 11.4))
            elif "{:.1f}°C" in msg_tpl:
                message = msg_tpl.format(random.uniform(106, 115))
            else:
                message = msg_tpl

            rows.append({
                "vehicle_id" : veh["vehicle_id"],
                "plate"      : veh["plate"],
                "device_id"  : veh["device_id"],
                "event_type" : evt_type,
                "level"      : level,
                "message"    : message,
                "event_at"   : ts.strftime("%Y-%m-%d %H:%M:%S"),
            })

    df = pd.DataFrame(rows)
    df.sort_values(["vehicle_id", "event_at"], inplace=True)
    return df.reset_index(drop=True)


# ── Sheet 4 — ai_labels ────────────────────────────────────────────────────────

def bump_severity(current: str, candidate: str) -> str:
    sev_order = {"info": 0, "warning": 1, "critical": 2}
    return candidate if sev_order[candidate] > sev_order[current] else current


def apply_rules(row: dict) -> tuple[str, str, int]:
    """
    Génère des labels IA plus nuancés et plus proches d'un vrai cas métier.
    Le score combine des seuils simples + des interactions non linéaires.
    """
    rules = []

    battery = float(row["battery_voltage"])
    temp = float(row["engine_temp"])
    fuel = float(row["fuel_level"])
    rpm_val = float(row["rpm"])
    load = float(row["engine_load"])
    speed = float(row.get("speed", 0))
    ambient = float(row.get("ambient_air_temp", 20))
    intake = float(row.get("intake_temp", ambient + 5))

    score = 0.0

    if battery < 11.5:
        # Batterie critique : risque élevé même si les autres capteurs sont bons
        rules.append("BATTERY_CRITICAL"); score += 55
    elif battery < 11.9:
        rules.append("BATTERY_LOW"); score += 22
    elif battery < 12.0:
        rules.append("BATTERY_WEAK"); score += 8
    elif battery < 12.5:
        # Moteur allumé mais tension trop basse → alternateur suspect
        rules.append("ALTERNATOR_WEAK"); score += 18
    elif battery > 15.8:
        # Surtension critique : peut endommager l'alternateur, le système électrique
        rules.append("BATTERY_OVERVOLTAGE_CRITICAL"); score += 35
    elif battery > 15.5:
        # Surtension : tension trop élevée, dommage système électrique possible
        rules.append("BATTERY_OVERVOLTAGE"); score += 22

    if temp > 106:
        rules.append("ENGINE_OVERHEAT"); score += 38
    elif temp > 99:
        # Embouteillage à 104°C doit clairement sortir en Warning
        rules.append("ENGINE_HOT"); score += 25
    elif temp > 94:
        rules.append("ENGINE_WARM"); score += 8

    if fuel < 5:
        rules.append("FUEL_CRITICAL"); score += 22
    elif fuel < 12:
        rules.append("FUEL_LOW"); score += 10

    if rpm_val > 4700:
        rules.append("RPM_HIGH"); score += 10
    elif rpm_val > 3900:
        rules.append("RPM_STRESSED"); score += 5

    if load > 88:
        rules.append("ENGINE_OVERLOAD"); score += 12
    elif load > 78:
        rules.append("LOAD_ELEVATED"); score += 5

    # Interactions non linéaires pour rendre le problème plus réaliste
    if battery < 12.0 and temp > 100:
        rules.append("BATTERY_TEMP_COMBO"); score += 12
    if load > 80 and rpm_val > 4000:
        rules.append("LOAD_RPM_STRESS"); score += 10
    if fuel < 12 and speed > 85:
        rules.append("LOW_FUEL_HIGHWAY"); score += 7
    if speed < 5 and rpm_val > 1600:
        rules.append("ABNORMAL_IDLE"); score += 6
    if ambient > 30 and intake - ambient > 8:
        rules.append("HOT_AIR_INTAKE"); score += 5

    score += max(0, (temp - 90) * 0.6)
    score += max(0, (12.5 - battery) * 7.0)
    # Wider jitter so scores don't cluster at a single value
    score += random.uniform(-4.0, 8.0)
    score = int(clamp(score, 0, 100))

    # Planchers de score — utiliser des plages aléatoires pour disperser
    # la distribution warning (36-64) plutôt qu'un pic fixe à 36.
    if battery < 11.5:
        score = max(score, random.randint(70, 86))
    if battery > 15.8:
        score = max(score, random.randint(70, 86))
    elif battery > 15.5:
        score = max(score, random.randint(36, 54))
    elif 12.0 <= battery < 12.5:
        score = max(score, random.randint(36, 52))
    if temp > 99 and temp <= 106:
        score = max(score, random.randint(36, 56))
    if temp > 106:
        score = max(score, random.randint(72, 90))

    if score >= 65 or (battery < 11.5):
        severity = "critical"
    elif score >= 35:
        severity = "warning"
    else:
        severity = "info"

    rule_str = ", ".join(rules) if rules else "NONE"
    return rule_str, severity, score


def rebalance_ai_labels_by_score(
    df: pd.DataFrame,
    target_info: int = TARGET_INFO_COUNT,
    target_warning: int = TARGET_WARNING_COUNT,
    target_critical: int = TARGET_CRITICAL_COUNT,
) -> pd.DataFrame:
    """
    Rééquilibre les classes en se basant sur risk_score:
    - scores les plus faibles -> info
    - scores les plus élevés -> critical
    - le milieu -> warning
    """
    if df.empty:
        return df

    rebalanced = df.copy()
    score = pd.to_numeric(rebalanced["risk_score"], errors="coerce").fillna(0)

    # Use separated score bands to reduce overlap/noise between classes.
    info_pool = rebalanced[score <= 30]
    warning_pool = rebalanced[(score >= 36) & (score <= 64)]
    critical_pool = rebalanced[score >= 70]

    # Fallback to broader bands if one pool is too small.
    if len(info_pool) < max(10, target_info // 10):
        info_pool = rebalanced[score <= 35]
    if len(warning_pool) < max(10, target_warning // 10):
        warning_pool = rebalanced[(score >= 30) & (score <= 70)]
    if len(critical_pool) < max(10, target_critical // 10):
        critical_pool = rebalanced[score >= 65]

    info_sample = info_pool.sample(n=target_info, replace=len(info_pool) < target_info, random_state=RANDOM_SEED).copy()
    warning_sample = warning_pool.sample(n=target_warning, replace=len(warning_pool) < target_warning, random_state=RANDOM_SEED + 1).copy()
    critical_sample = critical_pool.sample(n=target_critical, replace=len(critical_pool) < target_critical, random_state=RANDOM_SEED + 2).copy()

    info_sample["severity"] = "info"
    warning_sample["severity"] = "warning"
    critical_sample["severity"] = "critical"

    balanced = pd.concat([info_sample, warning_sample, critical_sample], ignore_index=True)
    balanced = balanced.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)

    # Trace explicite dans les règles pour audit du dataset synthétique.
    balanced["rule_triggered"] = balanced["rule_triggered"].astype(str) + ", REBALANCED_BY_SCORE_BANDS"
    return balanced


def _dtc_severity_to_num(value: str | None) -> int:
    val = str(value or "warning").strip().lower()
    if val == "critical":
        return 2
    if val == "warning":
        return 1
    return 0


def _attach_dtc_labels(ai_subset: pd.DataFrame, dtc_records: pd.DataFrame) -> pd.DataFrame:
    enriched = ai_subset.copy()
    enriched["has_active_dtc"] = 0
    enriched["active_dtc_count"] = 0
    enriched["max_dtc_severity"] = 0

    if dtc_records.empty:
        return enriched

    dtc = dtc_records.copy()
    dtc["first_detected"] = pd.to_datetime(dtc.get("first_detected"), errors="coerce")
    dtc["last_occurrence"] = pd.to_datetime(dtc.get("last_occurrence"), errors="coerce")
    dtc["resolved"] = dtc.get("resolved", False).fillna(False).astype(bool)
    dtc["severity_num"] = dtc.get("severity", "warning").map(_dtc_severity_to_num)

    for vehicle_id, idxs in enriched.groupby("vehicle_id").groups.items():
        vehicle_dtc = dtc[dtc["vehicle_id"] == vehicle_id]
        if vehicle_dtc.empty:
            continue

        for idx in idxs:
            ts = enriched.at[idx, "ts"]
            if pd.isna(ts):
                continue

            started = vehicle_dtc["first_detected"].notna() & (vehicle_dtc["first_detected"] <= ts)
            still_active = (~vehicle_dtc["resolved"]) | vehicle_dtc["last_occurrence"].isna() | (vehicle_dtc["last_occurrence"] >= ts)
            active = vehicle_dtc[started & still_active]

            if active.empty:
                continue

            active_count = int(len(active))
            enriched.at[idx, "has_active_dtc"] = 1
            enriched.at[idx, "active_dtc_count"] = active_count
            enriched.at[idx, "max_dtc_severity"] = int(active["severity_num"].max())

    return enriched


def _enrich_dtc_normal_telemetry_cases(ai_subset: pd.DataFrame) -> pd.DataFrame:
    """Boost labels for rows where telemetry is normal but DTCs are active.

    This teaches the model that active fault codes can carry risk even when
    sensor values look nominal at that instant.
    """
    enriched = ai_subset.copy()
    enriched["risk_score"] = pd.to_numeric(enriched.get("risk_score"), errors="coerce").fillna(0.0).astype(float)

    speed = pd.to_numeric(enriched.get("speed"), errors="coerce")
    rpm = pd.to_numeric(enriched.get("rpm"), errors="coerce")
    fuel = pd.to_numeric(enriched.get("fuel_level"), errors="coerce")
    temp = pd.to_numeric(enriched.get("engine_temp"), errors="coerce")
    battery = pd.to_numeric(enriched.get("battery_voltage"), errors="coerce")
    load = pd.to_numeric(enriched.get("engine_load"), errors="coerce")
    has_dtc = pd.to_numeric(enriched.get("has_active_dtc"), errors="coerce").fillna(0) >= 1

    normal_mask = (
        speed.between(0, 120, inclusive="both")
        & rpm.between(650, 3000, inclusive="both")
        & fuel.between(20, 90, inclusive="both")
        & temp.between(78, 96, inclusive="both")
        & battery.between(12.2, 14.6, inclusive="both")
        & load.between(8, 65, inclusive="both")
    )

    candidates = enriched[has_dtc & normal_mask]
    if candidates.empty:
        return enriched

    target_rows = min(len(candidates), max(500, int(len(enriched) * 0.18)))
    selected = candidates.sample(n=target_rows, replace=False, random_state=RANDOM_SEED + 77).index

    max_dtc = pd.to_numeric(enriched.loc[selected, "max_dtc_severity"], errors="coerce").fillna(1).astype(int)
    active_count = pd.to_numeric(enriched.loc[selected, "active_dtc_count"], errors="coerce").fillna(1)

    crit_idx = max_dtc[max_dtc >= 2].index
    warn_idx = max_dtc[max_dtc == 1].index
    info_idx = max_dtc[max_dtc <= 0].index

    if len(crit_idx) > 0:
        crit_base = pd.Series([random.uniform(72, 86) for _ in range(len(crit_idx))], index=crit_idx)
        crit_bonus = active_count.loc[crit_idx].clip(lower=1, upper=5) - 1
        enriched.loc[crit_idx, "risk_score"] = (crit_base + crit_bonus).clip(lower=70, upper=90)

    if len(warn_idx) > 0:
        warn_base = pd.Series([random.uniform(42, 58) for _ in range(len(warn_idx))], index=warn_idx)
        warn_bonus = (active_count.loc[warn_idx].clip(lower=1, upper=4) - 1) * 0.8
        enriched.loc[warn_idx, "risk_score"] = (warn_base + warn_bonus).clip(lower=40, upper=62)

    if len(info_idx) > 0:
        info_base = pd.Series([random.uniform(24, 34) for _ in range(len(info_idx))], index=info_idx)
        info_bonus = (active_count.loc[info_idx].clip(lower=1, upper=3) - 1) * 0.5
        enriched.loc[info_idx, "risk_score"] = (info_base + info_bonus).clip(lower=22, upper=36)

    dtc_only_selected = enriched.loc[selected]
    rule_suffix = dtc_only_selected.apply(
        lambda row: f"DTC_ACTIVE_NORMAL_TELEMETRY_S{int(pd.to_numeric(row.get('max_dtc_severity'), errors='coerce') or 0)}",
        axis=1,
    )
    enriched.loc[selected, "rule_triggered"] = (
        enriched.loc[selected, "rule_triggered"].astype(str)
        + ", "
        + rule_suffix.astype(str)
    )

    return enriched


def _attach_maintenance_labels(ai_subset: pd.DataFrame) -> pd.DataFrame:
    enriched = ai_subset.copy()

    oil_interval = 10_000.0
    service_interval = 20_000.0
    parts_interval = 35_000.0

    enriched["maintenance_interval_km"] = oil_interval
    enriched["service_interval_km"] = service_interval
    enriched["parts_interval_km"] = parts_interval

    # Use modulo-based synthetic cycles to emulate maintenance operations over time.
    odo = pd.to_numeric(enriched["odometer"], errors="coerce")
    offsets = {}
    for vehicle_id in enriched["vehicle_id"].dropna().unique().tolist():
        offsets[int(vehicle_id)] = {
            "oil": random.randint(500, 3_500),
            "service": random.randint(2_000, 7_000),
            "parts": random.randint(4_000, 12_000),
        }

    oil_offset = enriched["vehicle_id"].map(lambda v: offsets.get(int(v), {}).get("oil", 1_500) if pd.notna(v) else 1_500)
    service_offset = enriched["vehicle_id"].map(lambda v: offsets.get(int(v), {}).get("service", 4_500) if pd.notna(v) else 4_500)
    parts_offset = enriched["vehicle_id"].map(lambda v: offsets.get(int(v), {}).get("parts", 8_000) if pd.notna(v) else 8_000)

    enriched["last_oil_change_odometer"] = odo - ((odo + pd.to_numeric(oil_offset, errors="coerce")) % oil_interval)
    enriched["last_service_odometer"] = odo - ((odo + pd.to_numeric(service_offset, errors="coerce")) % service_interval)
    enriched["last_parts_change_odometer"] = odo - ((odo + pd.to_numeric(parts_offset, errors="coerce")) % parts_interval)

    return enriched


def gen_ai_labels(df_telem: pd.DataFrame, df_dtc: pd.DataFrame) -> pd.DataFrame:
    """Échantillonne un volume fixe puis applique les règles métier."""
    if len(df_telem) >= AI_LABELS_TARGET_ROWS:
        subset = df_telem.sample(n=AI_LABELS_TARGET_ROWS, random_state=RANDOM_SEED).copy()
    else:
        subset = df_telem.sample(n=AI_LABELS_TARGET_ROWS, replace=True, random_state=RANDOM_SEED).copy()
    subset = subset.sort_values(["vehicle_id", "ts"]).reset_index(drop=True)
    subset["ts"] = pd.to_datetime(subset["ts"], errors="coerce")

    results = subset.apply(
        lambda row: pd.Series(
            apply_rules(row.to_dict()),
            index=["rule_triggered", "severity", "risk_score"]
        ),
        axis=1,
    )
    subset = pd.concat([subset, results], axis=1)
    subset = _attach_dtc_labels(subset, df_dtc)
    subset = _enrich_dtc_normal_telemetry_cases(subset)
    subset = rebalance_ai_labels_by_score(subset)
    subset = _attach_maintenance_labels(subset)

    return subset[[
        "vehicle_id", "plate", "ts",
        "speed", "rpm", "engine_temp", "battery_voltage",
        "fuel_level", "engine_load",
        "ambient_air_temp", "intake_temp", "odometer",
        "last_oil_change_odometer", "last_service_odometer", "last_parts_change_odometer",
        "maintenance_interval_km", "service_interval_km", "parts_interval_km",
        "temp_cpu", "cpu", "gpu",
        "has_active_dtc", "active_dtc_count", "max_dtc_severity",
        "rule_triggered", "severity", "risk_score",
    ]].reset_index(drop=True)


def gen_recommendation_rules_simple() -> pd.DataFrame:
    """Generate one-row-per-rule table for backend recommendation engine.

    This sheet externalizes recommendation/maintenance business rules into
    tabular data so thresholds/messages are editable from the dataset file.
    """
    rows = [
        {
            "rule_id": "battery_critical_low",
            "variable": "battery_voltage",
            "seuil_min": None,
            "seuil_max": 11.5,
            "mode": "lt_min",
            "type_risque": "battery",
            "niveau": "critical",
            "message": "Batterie critique detectee",
            "component": "battery_system",
            "suggestion_priority": "high",
            "suggestion_title": "Batterie / alternateur",
            "suggestion_message": "Controler immediatement la batterie et le circuit de charge.",
            "ruleset": "sensor_rules",
            "condition_json": None,
        },
        {
            "rule_id": "battery_warning_low",
            "variable": "battery_voltage",
            "seuil_min": None,
            "seuil_max": 12.0,
            "mode": "lt_min",
            "type_risque": "battery",
            "niveau": "warning",
            "message": "Batterie en baisse detectee",
            "component": "battery_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Controle batterie",
            "suggestion_message": "Planifier une verification batterie dans les prochaines 48h.",
            "ruleset": "sensor_rules",
            "condition_json": None,
        },
        {
            "rule_id": "temp_critical",
            "variable": "engine_temp",
            "seuil_min": None,
            "seuil_max": 106,
            "mode": "gt_max",
            "type_risque": "cooling",
            "niveau": "critical",
            "message": "Surchauffe moteur detectee",
            "component": "cooling_system",
            "suggestion_priority": "high",
            "suggestion_title": "Systeme de refroidissement",
            "suggestion_message": "Verifier liquide de refroidissement, ventilateur et radiateur.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "temp_warning",
            "variable": "engine_temp",
            "seuil_min": None,
            "seuil_max": 99,
            "mode": "gt_max",
            "type_risque": "cooling",
            "niveau": "warning",
            "message": "Temperature moteur elevee",
            "component": "cooling_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Inspection moteur",
            "suggestion_message": "Prevoir une inspection du systeme de refroidissement.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "fuel_critical",
            "variable": "fuel_level",
            "seuil_min": None,
            "seuil_max": 5,
            "mode": "lt_min",
            "type_risque": "fuel",
            "niveau": "critical",
            "message": "Niveau de carburant critique",
            "component": "fuel_system",
            "suggestion_priority": "high",
            "suggestion_title": "Ravitaillement urgent",
            "suggestion_message": "Ravitailler immediatement - risque d'arret moteur.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "fuel_warning",
            "variable": "fuel_level",
            "seuil_min": None,
            "seuil_max": 12,
            "mode": "lt_min",
            "type_risque": "fuel",
            "niveau": "warning",
            "message": "Niveau de carburant faible",
            "component": "fuel_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Ravitaillement",
            "suggestion_message": "Prevoir un ravitaillement rapidement pour eviter l'arret du vehicule.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "speed_critical",
            "variable": "speed",
            "seuil_min": None,
            "seuil_max": 150,
            "mode": "gt_max",
            "type_risque": "driving_speed",
            "niveau": "critical",
            "message": "Vitesse vehicule excessivement elevee",
            "component": "",
            "suggestion_priority": "high",
            "suggestion_title": "Conduite a risque",
            "suggestion_message": "Reduire immediatement la vitesse et controler les conditions de roulage.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "speed_warning",
            "variable": "speed",
            "seuil_min": None,
            "seuil_max": 120,
            "mode": "gt_max",
            "type_risque": "driving_speed",
            "niveau": "warning",
            "message": "Vitesse vehicule elevee",
            "component": "",
            "suggestion_priority": "medium",
            "suggestion_title": "Conduite",
            "suggestion_message": "Adapter la vitesse pour limiter l'usure et les risques mecaniques.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "rpm_warning",
            "variable": "rpm",
            "seuil_min": None,
            "seuil_max": 4500,
            "mode": "gt_max",
            "type_risque": "driving_style",
            "niveau": "warning",
            "message": "Regime moteur eleve",
            "component": "",
            "suggestion_priority": "medium",
            "suggestion_title": "Style de conduite",
            "suggestion_message": "Analyser le style de conduite et eviter les sur-regimes prolonges.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "load_warning",
            "variable": "engine_load",
            "seuil_min": None,
            "seuil_max": 85,
            "mode": "gt_max",
            "type_risque": "engine_load",
            "niveau": "warning",
            "message": "Charge moteur elevee",
            "component": "engine_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Charge moteur",
            "suggestion_message": "Reduire la charge ou verifier les conditions de roulage et le systeme moteur.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "cpu_temp_critical",
            "variable": "temp_cpu",
            "seuil_min": None,
            "seuil_max": 90,
            "mode": "gt_max",
            "type_risque": "device_cpu_temp",
            "niveau": "critical",
            "message": "Temperature CPU boitier critique",
            "component": "telematics_device",
            "suggestion_priority": "high",
            "suggestion_title": "Boitier telematique",
            "suggestion_message": "Controler le refroidissement du boitier et l'exposition a la chaleur.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "cpu_temp_warning",
            "variable": "temp_cpu",
            "seuil_min": None,
            "seuil_max": 80,
            "mode": "gt_max",
            "type_risque": "device_cpu_temp",
            "niveau": "warning",
            "message": "Temperature CPU boitier elevee",
            "component": "telematics_device",
            "suggestion_priority": "medium",
            "suggestion_title": "Boitier telematique",
            "suggestion_message": "Surveiller la temperature CPU du boitier.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "cpu_load_warning",
            "variable": "cpu",
            "seuil_min": None,
            "seuil_max": 90,
            "mode": "gt_max",
            "type_risque": "device_cpu_load",
            "niveau": "warning",
            "message": "Charge CPU boitier elevee",
            "component": "",
            "suggestion_priority": "medium",
            "suggestion_title": "Charge systeme",
            "suggestion_message": "Verifier les taches telematiques actives (CPU eleve).",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "gpu_load_warning",
            "variable": "gpu",
            "seuil_min": None,
            "seuil_max": 90,
            "mode": "gt_max",
            "type_risque": "device_gpu_load",
            "niveau": "warning",
            "message": "Charge GPU boitier elevee",
            "component": "telematics_device",
            "suggestion_priority": "medium",
            "suggestion_title": "Charge systeme",
            "suggestion_message": "Verifier les charges GPU anormales sur le boitier.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "intake_critical",
            "variable": "intake_temp",
            "seuil_min": None,
            "seuil_max": 75,
            "mode": "gt_max",
            "type_risque": "intake",
            "niveau": "critical",
            "message": "Temperature d'admission critique",
            "component": "intake_system",
            "suggestion_priority": "high",
            "suggestion_title": "Admission d'air",
            "suggestion_message": "Controler le circuit d'admission et la circulation d'air moteur.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "intake_warning",
            "variable": "intake_temp",
            "seuil_min": None,
            "seuil_max": 60,
            "mode": "gt_max",
            "type_risque": "intake",
            "niveau": "warning",
            "message": "Temperature d'admission elevee",
            "component": "intake_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Admission d'air",
            "suggestion_message": "Inspecter le filtre et la prise d'air.",
            "ruleset": "sensor_rules",
        },
        {
            "rule_id": "ambient_warning",
            "variable": "ambient_air_temp",
            "seuil_min": None,
            "seuil_max": 40,
            "mode": "gt_max",
            "type_risque": "ambient_heat",
            "niveau": "warning",
            "message": "Temperature ambiante elevee",
            "component": "",
            "suggestion_priority": "low",
            "suggestion_title": "Conditions externes",
            "suggestion_message": "Adapter la conduite et surveiller les temperatures moteur en periode chaude.",
            "ruleset": "sensor_rules",
            "condition_json": None,
        },
        {
            "rule_id": "battery_warning_alt_suspect",
            "variable": "battery_voltage",
            "seuil_min": None,
            "seuil_max": None,
            "mode": None,
            "type_risque": "battery",
            "niveau": "warning",
            "message": "Tension basse moteur allume - alternateur suspect",
            "component": "battery_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Test alternateur",
            "suggestion_message": "Faire diagnostiquer l'alternateur ; la batterie ne se recharge pas correctement.",
            "ruleset": "sensor_rules",
            "condition_json": '{"all": [{"field": "battery_voltage", "op": "gte", "value": 12.0}, {"field": "battery_voltage", "op": "lt", "value": 12.5}, {"field": "rpm", "op": "gt", "value": 500}]}',
        },
        {
            "rule_id": "battery_critical_overvoltage",
            "variable": "battery_voltage",
            "seuil_min": None,
            "seuil_max": 15.8,
            "mode": "gt_max",
            "type_risque": "battery",
            "niveau": "critical",
            "message": "Surtension batterie critique detectee",
            "component": "battery_system",
            "suggestion_priority": "high",
            "suggestion_title": "Systeme electrique",
            "suggestion_message": "Verifier l'alternateur et le systeme de charge. Risque de dommage electrique.",
            "ruleset": "sensor_rules",
            "condition_json": None,
        },
        {
            "rule_id": "battery_warning_overvoltage",
            "variable": "battery_voltage",
            "seuil_min": None,
            "seuil_max": 15.5,
            "mode": "gt_max",
            "type_risque": "battery",
            "niveau": "warning",
            "message": "Surtension batterie detectee",
            "component": "battery_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Test alternateur",
            "suggestion_message": "Faire verifier le systeme de charge et l'alternateur rapidement.",
            "ruleset": "sensor_rules",
            "condition_json": None,
        },
    ]

    return pd.DataFrame(rows)


# ── Excel Writer with styling ──────────────────────────────────────────────────

HEADER_FILL = "1F4E79"   # bleu foncé
HEADER_FONT = "FFFFFF"   # blanc

def write_excel(sheets: dict[str, pd.DataFrame], path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)

    def _populate_workbook(writer):
        wb = writer.book

        # Formats
        header_fmt = wb.add_format({
            "bold": True, "font_color": HEADER_FONT,
            "bg_color": HEADER_FILL, "border": 1,
            "align": "center", "valign": "vcenter",
        })

        for sheet_name, df in sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False, startrow=1, header=False)
            ws = writer.sheets[sheet_name]

            # Écrire l'en-tête stylisé
            for col_num, col_name in enumerate(df.columns):
                ws.write(0, col_num, col_name, header_fmt)

            # Largeur des colonnes
            for col_num, col_name in enumerate(df.columns):
                # Use positional indexing to avoid issues with duplicate column names.
                series = df.iloc[:, col_num]
                max_len = max(len(str(col_name)), series.map(lambda v: len(str(v))).max())
                ws.set_column(col_num, col_num, min(max_len + 2, 30))

            # Freeze row 1
            ws.freeze_panes(1, 0)
            # Autofilter
            ws.autofilter(0, 0, len(df), len(df.columns) - 1)

    final_path = path
    try:
        with pd.ExcelWriter(final_path, engine="xlsxwriter") as writer:
            _populate_workbook(writer)
    except PermissionError:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        final_path = os.path.join(os.path.dirname(path), f"sample_dataset_{timestamp}.xlsx")
        with pd.ExcelWriter(final_path, engine="xlsxwriter") as writer:
            _populate_workbook(writer)
        print("⚠️  Le fichier principal était ouvert dans Excel ; une nouvelle version horodatée a été créée.")

    print(f"\n✅  Fichier Excel généré : {os.path.abspath(final_path)}")
    print(f"   Sheets : {list(sheets.keys())}")
    for name, df in sheets.items():
        print(f"   • {name:<20} {len(df):>5} lignes × {len(df.columns):>2} colonnes")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("⏳  Génération des données …")

    print("   → telemetry_data  …")
    df_telem = gen_telemetry()

    print("   → dtc_records     …")
    df_dtc   = gen_dtc()

    print("   → iot_logs        …")
    df_logs  = gen_iot_logs()

    print("   → ai_labels       …")
    df_ai    = gen_ai_labels(df_telem, df_dtc)

    print("   → recommendation_rules_simple …")
    df_rules = gen_recommendation_rules_simple()

    sheets = {
        "telemetry_data" : df_telem,
        "dtc_records"    : df_dtc,
        "iot_logs"       : df_logs,
        "ai_labels"      : df_ai,
        "recommendation_rules_simple": df_rules,
    }

    write_excel(sheets, OUTPUT_FILE)


if __name__ == "__main__":
    main()
