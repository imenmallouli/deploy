"""
test_model.py  — Teste le modèle IA sur 5 scénarios télémétrie + DTC.

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
from app.services.ia.recommendation_engine import RecommendationEngine


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
        },
    ),
]


def main():
    print("=" * 60)
    print("  TEST DU MODÈLE IA — Auto Diagnostic Platform")
    print("=" * 60)

    for label, payload in CASES:
        prediction = AIInferenceService.predict_from_payload(payload)
        enriched = RecommendationEngine.enrich_prediction(prediction)

        severity = enriched["predicted_severity"]
        score = enriched["predicted_risk_score"]
        confidence = enriched.get("confidence")
        risks = enriched.get("predicted_risks", [])
        suggestions = enriched.get("maintenance_suggestions", [])
        insight = enriched.get("ai_insights", {})

        sep = "─" * 60
        print(f"\n{sep}")
        print(f"  Scénario : {label}")
        print(sep)
        print(f"  Sévérité prédite  : {severity.upper()}")
        print(f"  Score de risque   : {score} / 100")
        print(f"  Confiance         : {confidence}%")
        print(f"  Modèle utilisé    : {enriched.get('model_family')}")

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

    print(f"\n{'=' * 60}")
    print("  Tous les tests terminés avec succès.")
    print("=" * 60)


if __name__ == "__main__":
    main()
