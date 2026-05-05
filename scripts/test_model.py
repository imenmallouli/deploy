"""
test_model.py  — Teste le modèle IA sur plusieurs scénarios télémétrie + DTC + maintenance.

Usage:
    python backend/scripts/test_model.py
"""
from __future__ import annotations
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.ia.inference_engine import AIInferenceService
from app.services.ia.model_loader import load_classifier_bundle
from app.services.ia.recommendation_engine import RecommendationEngine


MAINTENANCE_CONTEXT_KEYS = [
    "last_oil_change_odometer",
    "oil_change_interval_km",
    "last_maintenance_odometer",
    "maintenance_interval_km",
    "last_major_parts_change_odometer",
    "major_parts_interval_km",
    "maintenance_records",
]


CASES = [
    (
        "cas 1 — batterie + surchauffe + DTC",
        {
            "vehicle_id": 1,
            "plate": "TUN-001",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 155,
            "rpm": 4700,
            "fuel_level": 4,
            "engine_temp": 112,
            "battery_voltage": 11.2,
            "engine_load": 92,
            "ambient_air_temp": 43,
            "intake_temp": 82,
            "odometer": 175000,
            "temp_cpu": 93,
            "cpu": 96,
            "gpu": 94,
            "active_dtc_codes": ["P0562", "P0217", "P0300"],
            "last_oil_change_odometer": 160000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 150000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 100000,
            "major_parts_interval_km": 60000,
        },
    ),
    (
        "cas 2 — surchauffe modérée + DTC",
        {
            "vehicle_id": 2,
            "plate": "TUN-002",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 128,
            "rpm": 3200,
            "fuel_level": 10,
            "engine_temp": 107,
            "battery_voltage": 13.8,
            "engine_load": 87,
            "ambient_air_temp": 41,
            "intake_temp": 66,
            "odometer": 230000,
            "temp_cpu": 84,
            "cpu": 91,
            "gpu": 92,
            "active_dtc_codes": ["P0217", "P0420", "P0113"],
            "last_oil_change_odometer": 228000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 220000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 180000,
            "major_parts_interval_km": 60000,
        },
    ),
    (
        "cas 3 — normal + DTC légers",
        {
            "vehicle_id": 4,
            "plate": "TUN-004",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 100,
            "rpm": 2400,
            "fuel_level": 11,
            "engine_temp": 90,
            "battery_voltage": 14.0,
            "engine_load": 45,
            "ambient_air_temp": 22,
            "intake_temp": 32,
            "odometer": 120500,
            "temp_cpu": 81,
            "cpu": 65,
            "gpu": 35,
            "active_dtc_codes": ["P0442", "P0455"],
            "last_oil_change_odometer": 118000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 115000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 90000,
            "major_parts_interval_km": 60000,
        },
    ),
    (
        "cas 4 — codes DTC actifs P0300 + P0171 + télémétrie normale",
        {
            "vehicle_id": 5,
            "plate": "TUN-005",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 65,
            "rpm": 1800,
            "fuel_level": 50,
            "engine_temp": 92,
            "battery_voltage": 13.5,
            "engine_load": 35,
            "ambient_air_temp": 25,
            "intake_temp": 35,
            "odometer": 95000,
            "temp_cpu": 55,
            "cpu": 40,
            "gpu": 25,
            # Codes DTC actifs transmis avec le payload
            "active_dtc_codes": ["P0300", "P0171", "P0420"],
            "last_oil_change_odometer": 92000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 90000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 70000,
            "major_parts_interval_km": 60000,
        },
    ),
    (
        "cas 5 — codes DTC critiques P0562 (batterie) + P0217 (surchauffe) + télémétrie limite",
        {
            "vehicle_id": 6,
            "plate": "TUN-006",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 90,
            "rpm": 3000,
            "fuel_level": 20,
            "engine_temp": 108,
            "battery_voltage": 11.8,
            "engine_load": 75,
            "ambient_air_temp": 32,
            "intake_temp": 48,
            "odometer": 210000,
            "temp_cpu": 88,
            "cpu": 72,
            "gpu": 30,
            "active_dtc_codes": ["P0562", "P0217", "P0130", "P0300"],
            "last_oil_change_odometer": 195000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 185000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 130000,
            "major_parts_interval_km": 60000,
        },
    ),
    (
        "cas 6 — kilometrage tres eleve mais entretien recent (pas d'alerte maintenance)",
        {
            "vehicle_id": 7,
            "plate": "TUN-007",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 70,
            "rpm": 2100,
            "fuel_level": 40,
            "engine_temp": 93,
            "battery_voltage": 13.7,
            "engine_load": 35,
            "ambient_air_temp": 26,
            "intake_temp": 36,
            "odometer": 260000,
            "temp_cpu": 62,
            "cpu": 35,
            "gpu": 18,
            "active_dtc_codes": [],
            "last_oil_change_odometer": 255500,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 252000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 240000,
            "major_parts_interval_km": 60000,
            "maintenance_records": [
                {
                    "component": "oil_service",
                    "serviced_at_odometer": 255500,
                    "valid_for_km": 8000,
                    "note": "Vidange deja faite",
                },
                {
                    "component": "general_service",
                    "serviced_at_odometer": 252000,
                    "valid_for_km": 15000,
                    "note": "Entretien general recent",
                },
                {
                    "component": "major_parts",
                    "serviced_at_odometer": 240000,
                    "valid_for_km": 30000,
                    "note": "Pieces majeures remplacees",
                },
            ],
        },
    ),
    (
        "cas 7 — anomalies existantes mais deja reglees au dernier entretien",
        {
            "vehicle_id": 8,
            "plate": "TUN-008",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 80,
            "rpm": 2400,
            "fuel_level": 45,
            "engine_temp": 101,
            "battery_voltage": 11.9,
            "engine_load": 55,
            "ambient_air_temp": 28,
            "intake_temp": 39,
            "odometer": 150000,
            "temp_cpu": 70,
            "cpu": 40,
            "gpu": 20,
            "active_dtc_codes": ["P0562", "P0171", "P0420"],
            "maintenance_records": [
                {
                    "component": "battery_system",
                    "serviced_at_odometer": 149200,
                    "valid_for_km": 5000,
                    "note": "Batterie et alternateur controles",
                    "resolved_dtc_codes": ["P0562"],
                },
                {
                    "component": "cooling_system",
                    "serviced_at_odometer": 149000,
                    "valid_for_km": 5000,
                    "note": "Refroidissement repare",
                },
                {
                    "component": "dtc",
                    "serviced_at_odometer": 149500,
                    "valid_for_km": 4000,
                    "resolved_dtc_codes": ["P0171", "P0420"],
                },
            ],
        },
    ),
    (
        "cas 8 — kilometrage tres eleve mais moteur neuf + entretiens recents (doit rester OK)",
        {
            "vehicle_id": 9,
            "plate": "TUN-009",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 72,
            "rpm": 2200,
            "fuel_level": 52,
            "engine_temp": 91,
            "battery_voltage": 13.9,
            "engine_load": 33,
            "ambient_air_temp": 27,
            "intake_temp": 34,
            "odometer": 320000,
            "temp_cpu": 63,
            "cpu": 37,
            "gpu": 21,
            "active_dtc_codes": [],
            "last_oil_change_odometer": 317500,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 315000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 314000,
            "major_parts_interval_km": 60000,
            "maintenance_records": [
                {
                    "component": "engine_system",
                    "serviced_at_odometer": 314000,
                    "valid_for_km": 80000,
                    "note": "Moteur remplace/reconditionne recemment",
                },
                {
                    "component": "oil_service",
                    "serviced_at_odometer": 317500,
                    "valid_for_km": 10000,
                    "note": "Vidange recente",
                },
                {
                    "component": "general_service",
                    "serviced_at_odometer": 315000,
                    "valid_for_km": 20000,
                    "note": "Entretien complet recent",
                },
            ],
            "expected": {
                "maintenance_required": False,
                "maintenance_type": "none",
            },
        },
    ),
    (
        "cas 9 — kilometrage eleve + vidange depassee (doit alerter maintenance)",
        {
            "vehicle_id": 10,
            "plate": "TUN-010",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 68,
            "rpm": 2050,
            "fuel_level": 46,
            "engine_temp": 92,
            "battery_voltage": 13.8,
            "engine_load": 32,
            "ambient_air_temp": 26,
            "intake_temp": 33,
            "odometer": 320000,
            "temp_cpu": 61,
            "cpu": 35,
            "gpu": 19,
            "active_dtc_codes": [],
            "last_oil_change_odometer": 307000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 300000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 280000,
            "major_parts_interval_km": 60000,
            "expected": {
                "maintenance_required": True,
            },
        },
    ),
    (
        "cas 10 — kilometrage eleve sans historique entretien (fallback maintenance)",
        {
            "vehicle_id": 11,
            "plate": "TUN-011",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 70,
            "rpm": 2100,
            "fuel_level": 49,
            "engine_temp": 90,
            "battery_voltage": 13.9,
            "engine_load": 34,
            "ambient_air_temp": 25,
            "intake_temp": 32,
            "odometer": 245000,
            "temp_cpu": 60,
            "cpu": 34,
            "gpu": 18,
            "active_dtc_codes": [],
            "expected": {
                "maintenance_required": True,
            },
        },
    ),
    (
        "cas 11 — moteur neuf mais DTC critique actif (doit alerter quand meme)",
        {
            "vehicle_id": 12,
            "plate": "TUN-012",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 75,
            "rpm": 2300,
            "fuel_level": 55,
            "engine_temp": 92,
            "battery_voltage": 13.8,
            "engine_load": 36,
            "ambient_air_temp": 27,
            "intake_temp": 34,
            "odometer": 330000,
            "temp_cpu": 64,
            "cpu": 38,
            "gpu": 22,
            # DTC critique actif: doit declencher une alerte meme si tout l'entretien est recent.
            "active_dtc_codes": ["P0217"],
            "last_oil_change_odometer": 328000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 327000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 326000,
            "major_parts_interval_km": 60000,
            "maintenance_records": [
                {
                    "component": "engine_system",
                    "serviced_at_odometer": 326000,
                    "valid_for_km": 90000,
                    "note": "Moteur neuf",
                },
                {
                    "component": "oil_service",
                    "serviced_at_odometer": 328000,
                    "valid_for_km": 10000,
                    "note": "Vidange recente",
                },
                {
                    "component": "general_service",
                    "serviced_at_odometer": 327000,
                    "valid_for_km": 20000,
                    "note": "Entretien recent",
                },
            ],
            "expected": {
                "maintenance_required": True,
                "risk_types_must_include": ["dtc"],
                "risk_messages_must_include": ["P0217"],
            },
        },
    ),
    (
        "cas 12 — entretien recent mais valid_for_km expire de 500 km (doit re-alerter)",
        {
            "vehicle_id": 13,
            "plate": "TUN-013",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 74,
            "rpm": 2250,
            "fuel_level": 51,
            "engine_temp": 91,
            "battery_voltage": 11.3,
            "engine_load": 34,
            "ambient_air_temp": 27,
            "intake_temp": 33,
            "odometer": 250500,
            "temp_cpu": 62,
            "cpu": 36,
            "gpu": 20,
            "active_dtc_codes": ["P0562"],
            "last_oil_change_odometer": 248000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 246000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 230000,
            "major_parts_interval_km": 60000,
            # Service batterie existe, mais fenetre expiree de 500 km: 245000 + 5000 = 250000 < 250500
            "maintenance_records": [
                {
                    "component": "battery_system",
                    "serviced_at_odometer": 245000,
                    "valid_for_km": 5000,
                    "resolved_dtc_codes": ["P0562"],
                    "note": "Ancien service batterie",
                },
            ],
            "expected": {
                "maintenance_required": True,
                "risk_types_must_include": ["battery", "dtc"],
                "risk_messages_must_include": ["P0562"],
            },
        },
    ),
    (
        "cas 13 — entretien recent encore valide (controle anti faux positif)",
        {
            "vehicle_id": 14,
            "plate": "TUN-014",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 74,
            "rpm": 2250,
            "fuel_level": 51,
            "engine_temp": 91,
            "battery_voltage": 11.3,
            "engine_load": 34,
            "ambient_air_temp": 27,
            "intake_temp": 33,
            "odometer": 249900,
            "temp_cpu": 62,
            "cpu": 36,
            "gpu": 20,
            "active_dtc_codes": ["P0562"],
            "last_oil_change_odometer": 248000,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 246000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 230000,
            "major_parts_interval_km": 60000,
            # Fenetre encore valide: 245000 + 5000 = 250000 > 249900
            "maintenance_records": [
                {
                    "component": "battery_system",
                    "serviced_at_odometer": 245000,
                    "valid_for_km": 5000,
                    "resolved_dtc_codes": ["P0562"],
                    "note": "Service batterie encore valide",
                },
            ],
            "expected": {
                "maintenance_required": False,
                "maintenance_type": "none",
                "risk_types_must_exclude": ["battery", "dtc"],
                "risk_messages_must_exclude": ["P0562"],
            },
        },
    ),
    (
        "cas 14 — limite exacte valid_for_km (doit rester supprime)",
        {
            "vehicle_id": 15,
            "plate": "TUN-015",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 73,
            "rpm": 2200,
            "fuel_level": 50,
            "engine_temp": 91,
            "battery_voltage": 11.3,
            "engine_load": 35,
            "ambient_air_temp": 26,
            "intake_temp": 33,
            "odometer": 250000,
            "temp_cpu": 62,
            "cpu": 36,
            "gpu": 20,
            "active_dtc_codes": ["P0562"],
            "last_oil_change_odometer": 248500,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 246000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 230000,
            "major_parts_interval_km": 60000,
            # Delta exact = valid_for_km => encore valide (suppression attendue)
            "maintenance_records": [
                {
                    "component": "battery_system",
                    "serviced_at_odometer": 245000,
                    "valid_for_km": 5000,
                    "resolved_dtc_codes": ["P0562"],
                    "note": "Cas limite exact",
                },
            ],
            "expected": {
                "maintenance_required": False,
                "maintenance_type": "none",
                "risk_types_must_exclude": ["battery", "dtc"],
                "risk_messages_must_exclude": ["P0562"],
            },
        },
    ),
    (
        "cas 15 — limite depassee de 1 km (doit re-alerter)",
        {
            "vehicle_id": 16,
            "plate": "TUN-016",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 73,
            "rpm": 2200,
            "fuel_level": 50,
            "engine_temp": 91,
            "battery_voltage": 11.3,
            "engine_load": 35,
            "ambient_air_temp": 26,
            "intake_temp": 33,
            "odometer": 250001,
            "temp_cpu": 62,
            "cpu": 36,
            "gpu": 20,
            "active_dtc_codes": ["P0562"],
            "last_oil_change_odometer": 248500,
            "oil_change_interval_km": 10000,
            "last_maintenance_odometer": 246000,
            "maintenance_interval_km": 20000,
            "last_major_parts_change_odometer": 230000,
            "major_parts_interval_km": 60000,
            # Delta = valid_for_km + 1 => expire (alerte attendue)
            "maintenance_records": [
                {
                    "component": "battery_system",
                    "serviced_at_odometer": 245000,
                    "valid_for_km": 5000,
                    "resolved_dtc_codes": ["P0562"],
                    "note": "Cas limite +1",
                },
            ],
            "expected": {
                "maintenance_required": True,
                "risk_types_must_include": ["battery", "dtc"],
                "risk_messages_must_include": ["P0562"],
            },
        },
    ),
]


def main():
    feature_names = load_classifier_bundle().get("feature_names", [])
    maintenance_in_model = [k for k in MAINTENANCE_CONTEXT_KEYS if k in feature_names]

    print("=" * 60)
    print("  TEST DU MODÈLE IA — Auto Diagnostic Platform")
    print("=" * 60)
    print("  Vérification apprentissage des nouveaux champs maintenance")
    if maintenance_in_model:
        print(f"  -> Champs maintenance présents dans le modèle ML: {maintenance_in_model}")
    else:
        print("  -> Champs maintenance NON entraînés par le modèle ML (traités par règles métier)")

    checks_total = 0
    checks_passed = 0

    for label, payload in CASES:
        prediction = AIInferenceService.predict_from_payload(payload)
        enriched = RecommendationEngine.enrich_prediction(prediction)

        severity = enriched["predicted_severity"]
        score = enriched["predicted_risk_score"]
        confidence = enriched.get("confidence")
        risks = enriched.get("predicted_risks", [])
        suggestions = enriched.get("maintenance_suggestions", [])
        maintenance_status = enriched.get("maintenance_status", {})
        maintenance_filter = enriched.get("maintenance_filter", {})
        insight = enriched.get("ai_insights", {})

        sep = "─" * 60
        print(f"\n{sep}")
        print(f"  Scénario : {label}")
        print(sep)
        print(f"  Sévérité prédite  : {severity.upper()}")
        print(f"  Score de risque   : {score} / 100")
        print(f"  Confiance         : {confidence}%")
        print(f"  Modèle utilisé    : {enriched.get('model_family')}")
        print(
            "  Maintenance       : "
            f"required={maintenance_status.get('maintenance_required')} | "
            f"type={maintenance_status.get('maintenance_type')} | "
            f"priority={maintenance_status.get('priority')}"
        )
        print(f"  Résumé maintenance: {maintenance_status.get('summary')}")
        print(
            "  Filtre entretien : "
            f"applied={maintenance_filter.get('applied')} | "
            f"suppressed={len(maintenance_filter.get('suppressed_alerts', []))}"
        )

        if risks:
            print(f"\n  Risques détectés ({len(risks)}) :")
            for r in risks:
                val = f"  [valeur={r['value']}]" if r.get("value") is not None else ""
                print(f"    • [{r['severity'].upper()}] {r['type']}: {r['message']}{val}")

        if suggestions:
            print(f"\n  Suggestions de maintenance ({len(suggestions)}) :")
            for s in suggestions:
                print(f"    • [{s['priority'].upper()}] {s['title']}: {s['message']}")

        print(f"\n  Insight IA :")
        print(f"    Résumé       : {insight.get('summary')}")
        print(f"    Priorité     : {insight.get('priority')}")
        print(f"    Prochaine action : {insight.get('next_action')}")

        expected = payload.get("expected") if isinstance(payload, dict) else None
        if isinstance(expected, dict):
            checks_total += 1
            expected_required = expected.get("maintenance_required")
            expected_type = expected.get("maintenance_type")
            expected_risk_types_include = expected.get("risk_types_must_include", [])
            expected_risk_types_exclude = expected.get("risk_types_must_exclude", [])
            expected_messages_include = expected.get("risk_messages_must_include", [])
            expected_messages_exclude = expected.get("risk_messages_must_exclude", [])

            required_ok = (
                expected_required is None
                or maintenance_status.get("maintenance_required") == expected_required
            )
            type_ok = (
                expected_type is None
                or str(maintenance_status.get("maintenance_type", "")).lower() == str(expected_type).lower()
            )

            risk_types = [str(r.get("type", "")).lower() for r in risks]
            risk_messages = " ".join(str(r.get("message", "")) for r in risks)

            include_types_ok = all(str(t).lower() in risk_types for t in expected_risk_types_include)
            exclude_types_ok = all(str(t).lower() not in risk_types for t in expected_risk_types_exclude)
            include_msgs_ok = all(str(token) in risk_messages for token in expected_messages_include)
            exclude_msgs_ok = all(str(token) not in risk_messages for token in expected_messages_exclude)

            case_ok = required_ok and type_ok and include_types_ok and exclude_types_ok and include_msgs_ok and exclude_msgs_ok
            if case_ok:
                checks_passed += 1

            print(
                "\n  Check attendu : "
                f"maintenance_required={expected_required}"
                + (f" | maintenance_type={expected_type}" if expected_type is not None else "")
            )
            if expected_risk_types_include:
                print(f"  - risk_types_must_include={expected_risk_types_include}")
            if expected_risk_types_exclude:
                print(f"  - risk_types_must_exclude={expected_risk_types_exclude}")
            if expected_messages_include:
                print(f"  - risk_messages_must_include={expected_messages_include}")
            if expected_messages_exclude:
                print(f"  - risk_messages_must_exclude={expected_messages_exclude}")
            print(f"  Verdict check : {'PASS' if case_ok else 'FAIL'}")

    print(f"\n{'=' * 60}")
    if checks_total:
        print(f"  Résultat checks attendus : {checks_passed}/{checks_total} PASS")
    print("  Tous les tests terminés.")
    print("=" * 60)


if __name__ == "__main__":
    main()
