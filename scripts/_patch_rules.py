"""One-shot script: inject missing maintenance/fallback rules into gen_recommendation_rules_simple."""
import re
from pathlib import Path

path = Path(__file__).resolve().parent / "generate_sample_dataset.py"
content = path.read_text(encoding="utf-8")

# We locate the end of the rows list just before the premature return
# by finding the last occurrence of "},\n    ]\n\n    return pd.DataFrame(rows)"
# inside the gen_recommendation_rules_simple function.

MARKER = (
    '            "condition_json": None,\n'
    "        },\n"
    "    ]\n"
    "\n"
    "    return pd.DataFrame(rows)\n"
    "\n"
    "\n"
    "# ── Excel Writer with styling"
)

EXTRA_RULES = '''\
        # ── Thermal delta ─────────────────────────────────────────────────
        {
            "rule_id": "thermal_delta_warning",
            "variable": "thermal_delta",
            "seuil_min": None,
            "seuil_max": None,
            "mode": None,
            "type_risque": "thermal_delta",
            "niveau": "warning",
            "message": "Ecart thermique moteur/admission eleve",
            "component": "cooling_system",
            "suggestion_priority": "medium",
            "suggestion_title": "Diagnostic thermique",
            "suggestion_message": "Verifier capteurs temperature moteur/admission et circuit de refroidissement.",
            "ruleset": "sensor_rules",
            "condition_json": \'{"all": [{"field": "thermal_delta", "op": "gt", "value": 45}, {"any": [{"field": "engine_temp", "op": "gte", "value": 99}, {"field": "intake_temp", "op": "gte", "value": 60}]}]}\',
        },
        # ── Maintenance rules ─────────────────────────────────────────────
        {
            "rule_id": "oil_critical",
            "variable": "oil_ratio",
            "seuil_min": 1.2,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "maintenance_oil",
            "niveau": "critical",
            "message": "Vidange tres en retard",
            "component": "oil_service",
            "suggestion_priority": "high",
            "suggestion_title": "Vidange urgente",
            "suggestion_message": "Depasser fortement l\'intervalle de vidange. Faire la vidange immediatement.",
            "ruleset": "maintenance_rules",
            "condition_json": None,
        },
        {
            "rule_id": "oil_warning",
            "variable": "oil_ratio",
            "seuil_min": 1.0,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "maintenance_oil",
            "niveau": "warning",
            "message": "Vidange due",
            "component": "oil_service",
            "suggestion_priority": "medium",
            "suggestion_title": "Vidange",
            "suggestion_message": "Intervalle de vidange atteint. Planifier la vidange rapidement.",
            "ruleset": "maintenance_rules",
            "condition_json": None,
        },
        {
            "rule_id": "oil_info",
            "variable": "oil_ratio",
            "seuil_min": 0.85,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "maintenance_oil",
            "niveau": "info",
            "message": "Vidange bientot due",
            "component": "oil_service",
            "suggestion_priority": "low",
            "suggestion_title": "Preparation vidange",
            "suggestion_message": "La vidange approche. Preparer le rendez-vous d\'entretien.",
            "ruleset": "maintenance_rules",
            "condition_json": None,
        },
        {
            "rule_id": "service_warning",
            "variable": "service_ratio",
            "seuil_min": 1.15,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "maintenance_general",
            "niveau": "warning",
            "message": "Entretien general en retard",
            "component": "general_service",
            "suggestion_priority": "medium",
            "suggestion_title": "Entretien general",
            "suggestion_message": "L\'intervalle d\'entretien general est depasse. Planifier un controle complet.",
            "ruleset": "maintenance_rules",
            "condition_json": None,
        },
        {
            "rule_id": "service_info",
            "variable": "service_ratio",
            "seuil_min": 0.9,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "maintenance_general",
            "niveau": "info",
            "message": "Entretien general bientot du",
            "component": "general_service",
            "suggestion_priority": "low",
            "suggestion_title": "Preparation entretien",
            "suggestion_message": "Prevoir le prochain entretien general.",
            "ruleset": "maintenance_rules",
            "condition_json": None,
        },
        {
            "rule_id": "parts_warning",
            "variable": "parts_ratio",
            "seuil_min": 1.1,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "maintenance_parts",
            "niveau": "warning",
            "message": "Controle des pieces majeures recommande",
            "component": "major_parts",
            "suggestion_priority": "medium",
            "suggestion_title": "Pieces majeures",
            "suggestion_message": "Verifier l\'etat des pieces majeures selon l\'intervalle configure.",
            "ruleset": "maintenance_rules",
            "condition_json": None,
        },
        {
            "rule_id": "parts_info",
            "variable": "parts_ratio",
            "seuil_min": 0.9,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "maintenance_parts",
            "niveau": "info",
            "message": "Pieces majeures bientot a controler",
            "component": "major_parts",
            "suggestion_priority": "low",
            "suggestion_title": "Suivi pieces",
            "suggestion_message": "Prevoir un controle preventif des pieces majeures.",
            "ruleset": "maintenance_rules",
            "condition_json": None,
        },
        # ── Fallback rules ────────────────────────────────────────────────
        {
            "rule_id": "mileage_warning",
            "variable": "odometer",
            "seuil_min": 200000,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "mileage",
            "niveau": "warning",
            "message": "Kilometrage tres eleve - maintenance lourde a planifier",
            "component": "general_service",
            "suggestion_priority": "medium",
            "suggestion_title": "Maintenance kilometrage",
            "suggestion_message": "Prevoir un controle complet des organes moteur, refroidissement, admission et charge.",
            "ruleset": "fallback_rules",
            "condition_json": None,
        },
        {
            "rule_id": "mileage_info",
            "variable": "odometer",
            "seuil_min": 120000,
            "seuil_max": None,
            "mode": "gt_max",
            "type_risque": "mileage",
            "niveau": "info",
            "message": "Kilometrage eleve - maintenance preventive conseillee",
            "component": "general_service",
            "suggestion_priority": "low",
            "suggestion_title": "Entretien preventif",
            "suggestion_message": "Verifier l\'entretien periodique du vehicule en fonction du kilometrage.",
            "ruleset": "fallback_rules",
            "condition_json": None,
        },
'''

REPLACEMENT = (
    '            "condition_json": None,\n'
    "        },\n"
    + EXTRA_RULES
    + "    ]\n"
    "\n"
    "    return pd.DataFrame(rows)\n"
    "\n"
    "\n"
    "# ── Excel Writer with styling"
)

if MARKER in content:
    new_content = content.replace(MARKER, REPLACEMENT, 1)
    path.write_text(new_content, encoding="utf-8")
    # Count rule_ids
    count = new_content.count('"rule_id"')
    print(f"PATCHED OK — rule_id count: {count}")
else:
    # Try to locate the closing to diagnose
    idx = content.rfind("return pd.DataFrame(rows)")
    print("MARKER NOT FOUND. Context around last return:")
    print(repr(content[max(0, idx - 300):idx + 50]))
