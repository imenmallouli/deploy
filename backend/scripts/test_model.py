"""
test_model.py  — Teste le modèle IA sur 3 scénarios : info, warning, critical.

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
        "cas 1",
        {
            "vehicle_id": 1,
            "plate": "TUN-001",
            "ts": "2026-04-24T10:00:00Z",
            "speed":50,
            "rpm": 2000,
            "fuel_level": 40,
            "engine_temp": 112,
            "battery_voltage": 11.2,
            "engine_load":60,
            "ambient_air_temp":30,
            "intake_temp":45,
            "odometer": 175000,
        },
    ),
    (
        "cas 2",
        {
            "vehicle_id": 2,
            "plate": "TUN-002",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 30,
            "rpm": 1500,
            "fuel_level": 70,
            "engine_temp":107,
            "battery_voltage": 13.8,
            "engine_load": 20,
            "ambient_air_temp":15,
            "intake_temp": 20,
            "odometer": 230000,
        },
    ),
    (
        "cas3",
        {
            "vehicle_id": 4,
            "plate": "TUN-004",
            "ts": "2026-04-24T10:00:00Z",
            "speed": 100,
            "rpm": 2400,
            "fuel_level":15,
            "engine_temp":90,
            "battery_voltage": 14.0,
            "engine_load":45,
            "ambient_air_temp": 22,
            "intake_temp":32,
            "odometer":120500,
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
