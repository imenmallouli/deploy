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
    {"vehicle_id": 1, "plate": "TUN-001", "model": "Toyota Corolla 2020",  "device_id": "c917fc1199ff"},
    {"vehicle_id": 2, "plate": "TUN-002", "model": "Volkswagen Golf 2019", "device_id": "a1b2c3d4e5f6"},
    {"vehicle_id": 3, "plate": "TUN-003", "model": "Renault Clio 2021",    "device_id": "bbccdd001122"},
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
        ts_list    = gen_timestamp_series(ROWS_PER_VEH, START_DATE, INTERVAL_MIN)
        odometer   = 120_000.0 + random.uniform(0, 500)
        fuel_level = random.uniform(60, 95)
        engine_temp = 20.0          # moteur froid au démarrage

        for i, ts in enumerate(ts_list):
            hour = ts.hour

            # Simulation du cycle conduite
            driving = 7 <= hour <= 9 or 12 <= hour <= 13 or 17 <= hour <= 20
            speed   = random.uniform(30, 110) if driving else random.uniform(0, 10)
            rpm     = int(speed * 28 + random.uniform(-200, 200)) if speed > 5 else random.randint(600, 900)
            rpm     = clamp(rpm, 600, 4500)

            # Température moteur monte pendant la conduite
            if driving:
                engine_temp = clamp(engine_temp + random.uniform(0.5, 1.5), 80, 105)
            else:
                engine_temp = clamp(engine_temp - random.uniform(0.2, 0.8), 20, 105)

            engine_load     = clamp(speed * 0.6 + random.uniform(-5, 10), 10, 95)
            battery_voltage = round(random.uniform(13.2, 14.4) if driving else random.uniform(12.2, 12.8), 2)
            ambient_air_temp= round(18 + 10 * abs(hour - 13) / 13 * -1 + random.uniform(-2, 2), 1)
            intake_temp     = round(ambient_air_temp + random.uniform(3, 8), 1)

            fuel_level      = clamp(fuel_level - speed * 0.00015, 0, 100)
            odometer       += speed * (INTERVAL_MIN / 60)

            rows.append({
                "vehicle_id"       : veh["vehicle_id"],
                "plate"            : veh["plate"],
                "device_id"        : veh["device_id"],
                "ts"               : ts.strftime("%Y-%m-%d %H:%M:%S"),
                "speed"            : round(speed, 1),
                "rpm"              : rpm,
                "fuel_level"       : round(fuel_level, 2),
                "engine_temp"      : round(engine_temp, 1),
                "battery_voltage"  : battery_voltage,
                "engine_load"      : round(engine_load, 1),
                "ambient_air_temp" : ambient_air_temp,
                "intake_temp"      : intake_temp,
                "odometer"         : round(odometer, 1),
            })

    # Injecter quelques anomalies réalistes
    for row in random.sample(rows, k=40):
        anomaly = random.choice(["low_battery", "overheat", "low_fuel", "high_rpm"])
        if anomaly == "low_battery":
            row["battery_voltage"] = round(random.uniform(10.5, 11.4), 2)
        elif anomaly == "overheat":
            row["engine_temp"] = round(random.uniform(106, 115), 1)
        elif anomaly == "low_fuel":
            row["fuel_level"] = round(random.uniform(2, 8), 2)
        elif anomaly == "high_rpm":
            row["rpm"] = random.randint(4200, 5500)

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
    Règles métier → (rule_triggered, severity, risk_score 0-100)
    Reproduit exactement les règles de docs/conception_ia_alertes.md
    """
    rules   = []
    score   = 0
    severity = "info"

    battery = row["battery_voltage"]
    temp    = row["engine_temp"]
    fuel    = row["fuel_level"]
    rpm_val = row["rpm"]
    load    = row["engine_load"]

    if battery < 11.5:
        rules.append("BATTERY_CRITICAL"); score += 40; severity = bump_severity(severity, "critical")
    elif battery < 12.0:
        rules.append("BATTERY_LOW");      score += 20; severity = bump_severity(severity, "warning")

    if temp > 105:
        rules.append("ENGINE_OVERHEAT");  score += 45; severity = bump_severity(severity, "critical")
    elif temp > 100:
        rules.append("ENGINE_HOT");       score += 20; severity = bump_severity(severity, "warning")

    if fuel < 5:
        rules.append("FUEL_CRITICAL");    score += 30; severity = bump_severity(severity, "critical")
    elif fuel < 15:
        rules.append("FUEL_LOW");         score += 15; severity = bump_severity(severity, "warning")

    if rpm_val > 4500:
        rules.append("RPM_HIGH");         score += 5; severity = bump_severity(severity, "warning")

    if load > 85:
        rules.append("ENGINE_OVERLOAD");  score += 10; severity = bump_severity(severity, "warning")

    rule_str = ", ".join(rules) if rules else "NONE"
    return rule_str, severity, int(clamp(score, 0, 100))


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
