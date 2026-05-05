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
        speed = snapshot.get("speed")
        rpm = snapshot.get("rpm")
        load = snapshot.get("engine_load")
        intake_temp = snapshot.get("intake_temp")
        ambient_air_temp = snapshot.get("ambient_air_temp")
        odometer = snapshot.get("odometer")
        temp_cpu = snapshot.get("temp_cpu")
        cpu = snapshot.get("cpu")
        gpu = snapshot.get("gpu")
        active_dtc_events = prediction.get("active_dtc_events") or []

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

        # ── Batterie ──────────────────────────────────────────────────────────
        if battery is not None and battery < 11.5:
            add_risk("battery", "critical", "Batterie critique détectée", battery)
            add_suggestion("high", "Batterie / alternateur", "Contrôler immédiatement la batterie et le circuit de charge.")
        elif battery is not None and battery < 12.0:
            add_risk("battery", "warning", "Batterie en baisse détectée", battery)
            add_suggestion("medium", "Contrôle batterie", "Planifier une vérification batterie dans les prochaines 48h.")
        elif battery is not None and 12.0 <= battery < 12.5 and rpm is not None and rpm > 500:
            # Moteur allumé mais tension trop basse → alternateur défaillant
            add_risk("battery", "warning", "Tension basse moteur allumé — alternateur suspect", battery)
            add_suggestion("medium", "Test alternateur", "Faire diagnostiquer l'alternateur ; la batterie ne se recharge pas correctement.")
        elif battery is not None and battery > 15.8:
            add_risk("battery", "critical", "Surtension batterie critique détectée", battery)
            add_suggestion("high", "Système électrique", "Vérifier l'alternateur et le système de charge. Risque de dommage électrique.")
        elif battery is not None and battery > 15.5:
            add_risk("battery", "warning", "Surtension batterie détectée", battery)
            add_suggestion("medium", "Test alternateur", "Faire vérifier le système de charge et l'alternateur rapidement.")

        # ── Température moteur (aligné avec seuils dataset) ───────────────────
        if temp is not None and temp > 106:
            add_risk("cooling", "critical", "Surchauffe moteur détectée", temp)
            add_suggestion("high", "Système de refroidissement", "Vérifier liquide de refroidissement, ventilateur et radiateur.")
        elif temp is not None and temp >= 99:
            add_risk("cooling", "warning", "Température moteur élevée", temp)
            add_suggestion("medium", "Inspection moteur", "Prévoir une inspection du système de refroidissement.")

        # ── Carburant ─────────────────────────────────────────────────────────
        if fuel is not None and fuel < 5:
            add_risk("fuel", "critical", "Niveau de carburant critique", fuel)
            add_suggestion("high", "Ravitaillement urgent", "Ravitailler immédiatement — risque d'arrêt moteur.")
        elif fuel is not None and fuel < 12:
            add_risk("fuel", "warning", "Niveau de carburant faible", fuel)
            add_suggestion("medium", "Ravitaillement", "Prévoir un ravitaillement rapidement pour éviter l'arrêt du véhicule.")

        # ── Régime & charge ───────────────────────────────────────────────────
        if speed is not None and speed > 150:
            add_risk("driving_speed", "critical", "Vitesse vehicule excessivement elevee", speed)
            add_suggestion("high", "Conduite a risque", "Reduire immediatement la vitesse et controler les conditions de roulage.")
        elif speed is not None and speed > 120:
            add_risk("driving_speed", "warning", "Vitesse vehicule elevee", speed)
            add_suggestion("medium", "Conduite", "Adapter la vitesse pour limiter l'usure et les risques mecaniques.")

        if rpm is not None and rpm > 4500:
            add_risk("driving_style", "warning", "Régime moteur élevé", rpm)
            add_suggestion("medium", "Style de conduite", "Analyser le style de conduite et éviter les sur-régimes prolongés.")

        if load is not None and load >= 85:
            add_risk("engine_load", "warning", "Charge moteur élevée", load)
            add_suggestion("medium", "Charge moteur", "Réduire la charge ou vérifier les conditions de roulage et le système moteur.")

        # ── CPU / GPU / Températures périphériques ──────────────────────────
        if temp_cpu is not None and temp_cpu > 90:
            add_risk("device_cpu_temp", "critical", "Température CPU boîtier critique", temp_cpu)
            add_suggestion("high", "Boîtier télématique", "Contrôler le refroidissement du boîtier et l'exposition à la chaleur.")
        elif temp_cpu is not None and temp_cpu > 80:
            add_risk("device_cpu_temp", "warning", "Température CPU boîtier élevée", temp_cpu)
            add_suggestion("medium", "Boîtier télématique", "Surveiller la température CPU du boîtier.")

        if cpu is not None and cpu > 90:
            add_risk("device_cpu_load", "warning", "Charge CPU boîtier élevée", cpu)
            add_suggestion("medium", "Charge système", "Vérifier les tâches télématiques actives (CPU élevé).")

        if gpu is not None and gpu > 90:
            add_risk("device_gpu_load", "warning", "Charge GPU boîtier élevée", gpu)
            add_suggestion("medium", "Charge système", "Vérifier les charges GPU anormales sur le boîtier.")

        if intake_temp is not None and intake_temp > 75:
            add_risk("intake", "critical", "Température d'admission critique", intake_temp)
            add_suggestion("high", "Admission d'air", "Contrôler le circuit d'admission et la circulation d'air moteur.")
        elif intake_temp is not None and intake_temp > 60:
            add_risk("intake", "warning", "Température d'admission élevée", intake_temp)
            add_suggestion("medium", "Admission d'air", "Inspecter le filtre et la prise d'air.")

        if ambient_air_temp is not None and ambient_air_temp > 40:
            add_risk("ambient_heat", "warning", "Température ambiante élevée", ambient_air_temp)
            add_suggestion("low", "Conditions externes", "Adapter la conduite et surveiller les températures moteur en période chaude.")

        if temp is not None and intake_temp is not None and (temp - intake_temp) > 45:
            add_risk("thermal_delta", "warning", "Écart thermique moteur/admission élevé", temp - intake_temp)
            add_suggestion("medium", "Diagnostic thermique", "Vérifier capteurs température moteur/admission et circuit de refroidissement.")

        if odometer is not None and odometer >= 200000:
            add_risk("mileage", "warning", "Kilometrage tres eleve - maintenance lourde a planifier", odometer)
            add_suggestion("medium", "Maintenance kilometrage", "Prevoir un controle complet des organes moteur, refroidissement, admission et charge.")
        elif odometer is not None and odometer >= 120000:
            add_risk("mileage", "info", "Kilometrage eleve - maintenance preventive conseillee", odometer)
            add_suggestion("low", "Entretien preventif", "Verifier l'entretien periodique du vehicule en fonction du kilometrage.")

        # ── DTC actifs ───────────────────────────────────────────────────────
        for dtc in active_dtc_events:
            code = str(dtc.get("code") or "DTC_UNKNOWN")
            desc = str(dtc.get("description") or "Code défaut détecté")
            dtc_sev_raw = str(dtc.get("severity") or "warning").lower().strip()
            if dtc_sev_raw not in {"info", "warning", "critical"}:
                dtc_sev_raw = "warning"

            add_risk("dtc", dtc_sev_raw, f"{code}: {desc}", dtc.get("occurrence_count"))
            suggested_action = dtc.get("recommended_action") or f"Diagnostiquer le code {code} et corriger la cause racine."
            add_suggestion(
                "high" if dtc_sev_raw == "critical" else "medium",
                f"Code défaut {code}",
                suggested_action,
            )

        # ── Store raw ML output before any rule adjustment ─────────────────────
        ml_severity   = severity
        ml_risk_score = risk_score

        # ── Rule-based score floor (applied AFTER all sensor checks) ───────────
        # Rules only raise the score/severity; they never lower it.
        # The original ML values are preserved in `rule_override` for transparency.
        _has_critical_rule = any(r["severity"] == "critical" for r in predicted_risks)
        _critical_count    = sum(1 for r in predicted_risks if r["severity"] == "critical")
        _has_warning_rule  = any(r["severity"] == "warning"  for r in predicted_risks)

        if _critical_count >= 2:
            risk_score = max(risk_score, 85.0)
        elif _has_critical_rule:
            risk_score = max(risk_score, 70.0)
        elif _has_warning_rule:
            risk_score = max(risk_score, 36.0)

        # Promote severity if rule-corrected score crosses thresholds
        if risk_score >= 70:
            severity = "critical"
        elif risk_score >= 35 and severity == "info":
            severity = "warning"

        # Build override metadata so callers can see exactly what changed
        _score_changed    = round(risk_score, 2) != round(ml_risk_score, 2)
        _severity_changed = severity != ml_severity
        rule_override: dict | None = None
        if _score_changed or _severity_changed:
            triggered = []
            if _critical_count >= 2:
                triggered.append("double_critical_floor_85")
            elif _has_critical_rule:
                triggered.append("critical_floor_70")
            elif _has_warning_rule:
                triggered.append("warning_floor_36")
            if _severity_changed:
                triggered.append(f"severity_promoted_{ml_severity}_to_{severity}")
            rule_override = {
                "applied": True,
                "triggered_rules": triggered,
                "ml_severity": ml_severity,
                "ml_risk_score": round(ml_risk_score, 2),
                "adjusted_severity": severity,
                "adjusted_risk_score": round(risk_score, 2),
            }
        else:
            rule_override = {"applied": False, "ml_severity": ml_severity, "ml_risk_score": round(ml_risk_score, 2)}

        if not maintenance_suggestions:
            add_suggestion("low", "Etat normal", "Aucune anomalie detectee actuellement.")

        if predicted_risks:
            risk_labels = {
                "battery": "batterie",
                "cooling": "refroidissement",
                "fuel": "carburant",
                "driving_style": "style de conduite",
                "engine_load": "charge moteur",
                "device_cpu_temp": "température CPU",
                "device_cpu_load": "charge CPU",
                "device_gpu_load": "charge GPU",
                "intake": "admission",
                "ambient_heat": "température ambiante",
                "thermal_delta": "écart thermique",
                "driving_speed": "vitesse vehicule",
                "mileage": "kilometrage",
                "dtc": "codes défaut",
            }
            alert_domains = []
            for risk in predicted_risks:
                domain = risk_labels.get(risk.get("type", ""), str(risk.get("type", "alerte")))
                if domain and domain not in alert_domains:
                    alert_domains.append(domain)

            if risk_score >= 75 or severity == "critical":
                priority = "high"
            elif risk_score >= 40 or severity == "warning":
                priority = "medium"
            else:
                priority = "low"

            if len(alert_domains) == 1:
                summary = f"Alerte détectée: {alert_domains[0]}."
            else:
                summary = f"Alertes détectées: {', '.join(alert_domains)}."

            next_action = f"Alerte principale: {predicted_risks[0]['message']}"
        else:
            priority = "low"
            summary = "Aucune anomalie détectée."
            next_action = ""

        maintenance_required = any(r["severity"] in {"warning", "critical"} for r in predicted_risks)
        preventive_only = (not maintenance_required) and any(r["severity"] == "info" for r in predicted_risks)
        maintenance_reasons = [str(r["message"]) for r in predicted_risks[:5]]

        if any(r["severity"] == "critical" for r in predicted_risks):
            maintenance_status = {
                "maintenance_required": True,
                "maintenance_type": "urgent",
                "priority": "high",
                "summary": "Maintenance urgente requise.",
                "reasons": maintenance_reasons,
            }
        elif maintenance_required:
            maintenance_status = {
                "maintenance_required": True,
                "maintenance_type": "planned",
                "priority": "medium",
                "summary": "Maintenance recommandee prochainement.",
                "reasons": maintenance_reasons,
            }
        elif preventive_only:
            maintenance_status = {
                "maintenance_required": False,
                "maintenance_type": "preventive",
                "priority": "low",
                "summary": "Entretien preventif conseille.",
                "reasons": maintenance_reasons,
            }
        else:
            maintenance_status = {
                "maintenance_required": False,
                "maintenance_type": "none",
                "priority": "low",
                "summary": "Aucune maintenance necessaire actuellement.",
                "reasons": [],
            }

        prediction["predicted_risks"] = predicted_risks
        prediction["maintenance_status"] = maintenance_status
        prediction["maintenance_suggestions"] = maintenance_suggestions
        prediction["predicted_risk_score"] = round(risk_score, 2)
        prediction["predicted_severity"]   = severity
        prediction["rule_override"]        = rule_override
        prediction["ai_insights"] = {
            "summary": summary,
            "priority": priority,
            "next_action": next_action,
        }
        return prediction
