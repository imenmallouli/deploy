from __future__ import annotations


class RecommendationEngine:
    @staticmethod
    def enrich_prediction(prediction: dict) -> dict:
        snapshot = prediction.get("telemetry_snapshot", {})
        severity = str(prediction.get("predicted_severity", "info"))
        risk_score = float(prediction.get("predicted_risk_score", 0))

        battery = snapshot.get("battery_voltage")
        temp = snapshot.get("engine_temp")
        fuel = snapshot.get("fuel_level")
        rpm = snapshot.get("rpm")
        load = snapshot.get("engine_load")

        predicted_risks: list[dict] = []
        maintenance_suggestions: list[dict] = []

        def add_risk(risk_type: str, risk_severity: str, message: str, value=None):
            predicted_risks.append(
                {
                    "type": risk_type,
                    "severity": risk_severity,
                    "message": message,
                    "value": value,
                }
            )

        def add_suggestion(priority: str, title: str, message: str):
            maintenance_suggestions.append(
                {
                    "priority": priority,
                    "title": title,
                    "message": message,
                }
            )

        if battery is not None and battery < 11.5:
            add_risk("battery", "critical", "Batterie critique détectée", battery)
            add_suggestion("high", "Batterie / alternateur", "Contrôler immédiatement la batterie et le circuit de charge.")
        elif battery is not None and battery < 12.0:
            add_risk("battery", "warning", "Batterie en baisse détectée", battery)
            add_suggestion("medium", "Contrôle batterie", "Planifier une vérification batterie dans les prochaines 48h.")

        if temp is not None and temp >= 105:
            add_risk("cooling", "critical", "Surchauffe moteur probable", temp)
            add_suggestion("high", "Système de refroidissement", "Vérifier liquide de refroidissement, ventilateur et radiateur.")
        elif temp is not None and temp >= 98:
            add_risk("cooling", "warning", "Température moteur élevée", temp)
            add_suggestion("medium", "Inspection moteur", "Prévoir une inspection du système de refroidissement.")

        if fuel is not None and fuel < 10:
            add_risk("fuel", "warning", "Niveau de carburant faible", fuel)
            add_suggestion("medium", "Ravitaillement", "Prévoir un ravitaillement rapidement pour éviter l'arrêt du véhicule.")

        if rpm is not None and rpm > 4500:
            add_risk("driving_style", "warning", "Régime moteur élevé", rpm)
            add_suggestion("medium", "Style de conduite", "Analyser le style de conduite et éviter les sur-régimes prolongés.")

        if load is not None and load > 85:
            add_risk("engine_load", "warning", "Charge moteur élevée", load)
            add_suggestion("medium", "Charge moteur", "Réduire la charge ou vérifier les conditions de roulage et le système moteur.")

        if not maintenance_suggestions:
            add_suggestion("low", "Maintenance préventive", "Aucune anomalie majeure détectée. Continuer la maintenance préventive normale.")

        if risk_score >= 75 or severity == "critical":
            priority = "high"
            summary = "Le véhicule présente un risque élevé et nécessite une intervention rapide."
        elif risk_score >= 40 or severity == "warning":
            priority = "medium"
            summary = "Le véhicule présente un risque modéré ; une maintenance préventive est recommandée."
        else:
            priority = "low"
            summary = "Le véhicule semble stable pour le moment, avec un risque faible."

        prediction["predicted_risks"] = predicted_risks
        prediction["maintenance_suggestions"] = maintenance_suggestions
        prediction["ai_insights"] = {
            "summary": summary,
            "priority": priority,
            "next_action": maintenance_suggestions[0]["message"],
        }
        return prediction
