"""
generate_sample_dataset.py
Génère un fichier Excel de démonstration avec des données réalistes
correspondant exactement au schéma backend de la plateforme Auto Diagnostic.

Sheets:
  1. telemetry_data  — mesures OBD (9 métriques) par véhicule sur 7 jours
  2. dtc_records     — codes de défaut DTC enregistrés
  3. iot_logs        — logs événements device AutoPi
  4. ai_labels       — étiquettes IA / Risk Score dérivés des règles métier

Usage:
    python backend/scripts/generate_sample_dataset.py
Output:
    backend/data/sample_dataset.xlsx
"""

import os
import random
from datetime import datetime, timedelta

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
]

START_DATE   = datetime(2026, 3, 25, 6, 0, 0)
INTERVAL_MIN = 5          # une mesure toutes les 5 minutes
DAYS         = 7          # 7 jours de données
ROWS_PER_VEH = (DAYS * 24 * 60) // INTERVAL_MIN   # ~2016 lignes / véhicule


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
            })

    # Injecter un mélange de cas faibles, modérés et critiques
    for row in random.sample(rows, k=140):
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

def gen_dtc():
    rows = []
    for veh in VEHICLES:
        sample = random.sample(DTC_CATALOG, k=random.randint(3, 7))
        for code, desc, severity in sample:
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

    if battery < 11.4:
        rules.append("BATTERY_CRITICAL"); score += 30
    elif battery < 11.9:
        rules.append("BATTERY_LOW"); score += 16
    elif battery < 12.3:
        rules.append("BATTERY_WEAK"); score += 6

    if temp > 106:
        rules.append("ENGINE_OVERHEAT"); score += 32
    elif temp > 99:
        rules.append("ENGINE_HOT"); score += 15
    elif temp > 94:
        rules.append("ENGINE_WARM"); score += 5

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

    score += max(0, (temp - 90) * 0.4)
    score += max(0, (12.5 - battery) * 4.5)
    score += random.uniform(-3.5, 3.5)
    score = int(clamp(score, 0, 100))

    if score >= 65 or (battery < 11.3 and temp > 104):
        severity = "critical"
    elif score >= 28:
        severity = "warning"
    else:
        severity = "info"

    rule_str = ", ".join(rules) if rules else "NONE"
    return rule_str, severity, score


def gen_ai_labels(df_telem: pd.DataFrame) -> pd.DataFrame:
    """Sélectionne 1 ligne sur 5 et applique les règles métier."""
    subset = df_telem[df_telem.index % 5 == 0].copy()

    results = subset.apply(
        lambda row: pd.Series(
            apply_rules(row.to_dict()),
            index=["rule_triggered", "severity", "risk_score"]
        ),
        axis=1,
    )
    subset = pd.concat([subset, results], axis=1)

    return subset[[
        "vehicle_id", "plate", "ts",
        "speed", "rpm", "engine_temp", "battery_voltage",
        "fuel_level", "engine_load",
        "rule_triggered", "severity", "risk_score",
    ]].reset_index(drop=True)


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
                max_len = max(len(str(col_name)), df[col_name].astype(str).map(len).max())
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
    df_ai    = gen_ai_labels(df_telem)

    sheets = {
        "telemetry_data" : df_telem,
        "dtc_records"    : df_dtc,
        "iot_logs"       : df_logs,
        "ai_labels"      : df_ai,
    }

    write_excel(sheets, OUTPUT_FILE)


if __name__ == "__main__":
    main()
