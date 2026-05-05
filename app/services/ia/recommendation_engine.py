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
        maintenance_context = prediction.get("maintenance_context") or {}
        maintenance_records = prediction.get("maintenance_records") or []

        predicted_risks: list[dict] = []
        maintenance_suggestions: list[dict] = []
        suppressed_alerts: list[dict] = []

        def _is_recently_serviced(component: str | None = None, dtc_code: str | None = None) -> tuple[bool, str | None]:
            if not maintenance_records:
                return False, None
            if odometer is None:
                return False, None

            target_component = (component or "").strip().lower()
            target_code = (dtc_code or "").strip().upper()

            for record in maintenance_records:
                if not isinstance(record, dict):
                    continue

                record_component = str(record.get("component") or "").strip().lower()
                serviced_at = record.get("serviced_at_odometer")
                valid_for_km = record.get("valid_for_km")
                resolved_codes = [str(c).strip().upper() for c in (record.get("resolved_dtc_codes") or []) if str(c).strip()]

                try:
                    serviced_at_val = float(serviced_at) if serviced_at is not None else None
                    valid_for_km_val = float(valid_for_km) if valid_for_km is not None else 0.0
                except (TypeError, ValueError):
                    continue

                if serviced_at_val is None or valid_for_km_val <= 0:
                    continue

                delta = float(odometer) - serviced_at_val
                if delta < 0 or delta > valid_for_km_val:
                    continue

                component_match = bool(target_component) and record_component in {target_component, "all"}
                code_match = bool(target_code) and target_code in resolved_codes

                if component_match or code_match:
                    reason = f"recent_service:{record_component or 'unknown'} ({int(delta)}km/{int(valid_for_km_val)}km)"
                    return True, reason

            return False, None

        def add_risk(risk_type: str, risk_severity: str, message: str, value=None, component: str | None = None, dtc_code: str | None = None):
            suppressed, reason = _is_recently_serviced(component=component, dtc_code=dtc_code)
            if suppressed:
                suppressed_alerts.append(
                    {
                        "risk_type": risk_type,
                        "message": message,
                        "component": component,
                        "dtc_code": dtc_code,
                        "reason": reason,
                    }
                )
                return False

            predicted_risks.append(
                {
                    "type": risk_type,
                    "severity": risk_severity,
                    "message": message,
                    "value": value,
                }
            )
            return True

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
            if add_risk("battery", "critical", "Batterie critique détectée", battery, component="battery_system"):
                add_suggestion("high", "Batterie / alternateur", "Contrôler immédiatement la batterie et le circuit de charge.")
        elif battery is not None and battery < 12.0:
            if add_risk("battery", "warning", "Batterie en baisse détectée", battery, component="battery_system"):
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
            if add_risk("cooling", "critical", "Surchauffe moteur détectée", temp, component="cooling_system"):
                add_suggestion("high", "Système de refroidissement", "Vérifier liquide de refroidissement, ventilateur et radiateur.")
        elif temp is not None and temp >= 99:
            if add_risk("cooling", "warning", "Température moteur élevée", temp, component="cooling_system"):
                add_suggestion("medium", "Inspection moteur", "Prévoir une inspection du système de refroidissement.")

        # ── Carburant ─────────────────────────────────────────────────────────
        if fuel is not None and fuel < 5:
            if add_risk("fuel", "critical", "Niveau de carburant critique", fuel, component="fuel_system"):
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
            if add_risk("engine_load", "warning", "Charge moteur élevée", load, component="engine_system"):
                add_suggestion("medium", "Charge moteur", "Réduire la charge ou vérifier les conditions de roulage et le système moteur.")

        # ── CPU / GPU / Températures périphériques ──────────────────────────
        if temp_cpu is not None and temp_cpu > 90:
            if add_risk("device_cpu_temp", "critical", "Température CPU boîtier critique", temp_cpu, component="telematics_device"):
                add_suggestion("high", "Boîtier télématique", "Contrôler le refroidissement du boîtier et l'exposition à la chaleur.")
        elif temp_cpu is not None and temp_cpu > 80:
            add_risk("device_cpu_temp", "warning", "Température CPU boîtier élevée", temp_cpu)
            add_suggestion("medium", "Boîtier télématique", "Surveiller la température CPU du boîtier.")

        if cpu is not None and cpu > 90:
            add_risk("device_cpu_load", "warning", "Charge CPU boîtier élevée", cpu)
            add_suggestion("medium", "Charge système", "Vérifier les tâches télématiques actives (CPU élevé).")

        if gpu is not None and gpu > 90:
            if add_risk("device_gpu_load", "warning", "Charge GPU boîtier élevée", gpu, component="telematics_device"):
                add_suggestion("medium", "Charge système", "Vérifier les charges GPU anormales sur le boîtier.")

        if intake_temp is not None and intake_temp > 75:
            if add_risk("intake", "critical", "Température d'admission critique", intake_temp, component="intake_system"):
                add_suggestion("high", "Admission d'air", "Contrôler le circuit d'admission et la circulation d'air moteur.")
        elif intake_temp is not None and intake_temp > 60:
            add_risk("intake", "warning", "Température d'admission élevée", intake_temp)
            add_suggestion("medium", "Admission d'air", "Inspecter le filtre et la prise d'air.")

        if ambient_air_temp is not None and ambient_air_temp > 40:
            add_risk("ambient_heat", "warning", "Température ambiante élevée", ambient_air_temp)
            add_suggestion("low", "Conditions externes", "Adapter la conduite et surveiller les températures moteur en période chaude.")

        if (
            temp is not None
            and intake_temp is not None
            and (temp - intake_temp) > 45
            and (temp >= 99 or intake_temp >= 60)
        ):
            if add_risk("thermal_delta", "warning", "Écart thermique moteur/admission élevé", temp - intake_temp, component="cooling_system"):
                add_suggestion("medium", "Diagnostic thermique", "Vérifier capteurs température moteur/admission et circuit de refroidissement.")

        # ── Maintenance par intervalle depuis dernier entretien ─────────────
        def _safe_delta(current: float | None, previous: float | None) -> float | None:
            if current is None or previous is None:
                return None
            try:
                delta = float(current) - float(previous)
            except (TypeError, ValueError):
                return None
            return delta if delta >= 0 else None

        last_oil = maintenance_context.get("last_oil_change_odometer")
        oil_interval = maintenance_context.get("oil_change_interval_km")
        if odometer is not None and last_oil is not None and oil_interval and oil_interval > 0:
            oil_delta = _safe_delta(odometer, last_oil)
            if oil_delta is not None:
                if oil_delta >= oil_interval * 1.20:
                    if add_risk("maintenance_oil", "critical", "Vidange tres en retard", oil_delta, component="oil_service"):
                        add_suggestion("high", "Vidange urgente", "Depasser fortement l'intervalle de vidange. Faire la vidange immediatement.")
                elif oil_delta >= oil_interval:
                    add_risk("maintenance_oil", "warning", "Vidange due", oil_delta)
                    add_suggestion("medium", "Vidange", "Intervalle de vidange atteint. Planifier la vidange rapidement.")
                elif oil_delta >= oil_interval * 0.85:
                    add_risk("maintenance_oil", "info", "Vidange bientot due", oil_delta)
                    add_suggestion("low", "Preparation vidange", "La vidange approche. Preparer le rendez-vous d'entretien.")

        last_service = maintenance_context.get("last_maintenance_odometer")
        service_interval = maintenance_context.get("maintenance_interval_km")
        if odometer is not None and last_service is not None and service_interval and service_interval > 0:
            service_delta = _safe_delta(odometer, last_service)
            if service_delta is not None:
                if service_delta >= service_interval * 1.15:
                    if add_risk("maintenance_general", "warning", "Entretien general en retard", service_delta, component="general_service"):
                        add_suggestion("medium", "Entretien general", "L'intervalle d'entretien general est depasse. Planifier un controle complet.")
                elif service_delta >= service_interval * 0.90:
                    add_risk("maintenance_general", "info", "Entretien general bientot du", service_delta)
                    add_suggestion("low", "Preparation entretien", "Prevoir le prochain entretien general.")

        last_parts = maintenance_context.get("last_major_parts_change_odometer")
        parts_interval = maintenance_context.get("major_parts_interval_km")
        if odometer is not None and last_parts is not None and parts_interval and parts_interval > 0:
            parts_delta = _safe_delta(odometer, last_parts)
            if parts_delta is not None:
                if parts_delta >= parts_interval * 1.10:
                    if add_risk("maintenance_parts", "warning", "Controle des pieces majeures recommande", parts_delta, component="major_parts"):
                        add_suggestion("medium", "Pieces majeures", "Verifier l'etat des pieces majeures selon l'intervalle configure.")
                elif parts_delta >= parts_interval * 0.90:
                    add_risk("maintenance_parts", "info", "Pieces majeures bientot a controler", parts_delta)
                    add_suggestion("low", "Suivi pieces", "Prevoir un controle preventif des pieces majeures.")

        # Fallback historique: si aucune info d'entretien n'est fournie, utiliser kilometrage brut.
        has_maintenance_baseline = bool(maintenance_records) or any(
            maintenance_context.get(k) is not None
            for k in (
                "last_oil_change_odometer",
                "last_maintenance_odometer",
                "last_major_parts_change_odometer",
            )
        )
        if not has_maintenance_baseline and odometer is not None:
            if odometer >= 200000:
                if add_risk("mileage", "warning", "Kilometrage tres eleve - maintenance lourde a planifier", odometer, component="general_service"):
                    add_suggestion("medium", "Maintenance kilometrage", "Prevoir un controle complet des organes moteur, refroidissement, admission et charge.")
            elif odometer >= 120000:
                if add_risk("mileage", "info", "Kilometrage eleve - maintenance preventive conseillee", odometer, component="general_service"):
                    add_suggestion("low", "Entretien preventif", "Verifier l'entretien periodique du vehicule en fonction du kilometrage.")

        # ── DTC actifs ───────────────────────────────────────────────────────
        for dtc in active_dtc_events:
            code = str(dtc.get("code") or "DTC_UNKNOWN")
            desc = str(dtc.get("description") or "Code défaut détecté")
            dtc_sev_raw = str(dtc.get("severity") or "warning").lower().strip()
            if dtc_sev_raw not in {"info", "warning", "critical"}:
                dtc_sev_raw = "warning"

            if add_risk("dtc", dtc_sev_raw, f"{code}: {desc}", dtc.get("occurrence_count"), component="dtc", dtc_code=code):
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

        # Build override metadata after suppression-aware post-processing.
        rule_override: dict | None = None

        if not maintenance_suggestions:
            add_suggestion("low", "Etat normal", "Aucune anomalie detectee actuellement.")

        if predicted_risks:
            severity_rank = {"critical": 3, "warning": 2, "info": 1}
            suggestion_priority_rank = {"high": 3, "medium": 2, "low": 1}

            # Keep all active alerts but order them by severity so the UI can
            # display urgent anomalies first without dropping any item.
            predicted_risks.sort(
                key=lambda r: (
                    -severity_rank.get(str(r.get("severity", "info")).lower(), 1),
                    str(r.get("type", "")),
                    str(r.get("message", "")),
                )
            )

            # Same idea for recommendations: high priority first.
            maintenance_suggestions.sort(
                key=lambda s: (
                    -suggestion_priority_rank.get(str(s.get("priority", "low")).lower(), 1),
                    str(s.get("title", "")),
                )
            )

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

            # Show all active anomalies (after suppression of already-resolved ones)
            # and keep priority order for quick operational reading.
            key_messages: list[str] = []
            for risk in predicted_risks:
                msg = str(risk.get("message") or "").strip()
                if msg and msg not in key_messages:
                    key_messages.append(msg)

            next_action = f"Anomalies prioritaires: {' | '.join(key_messages)}" if key_messages else ""
        else:
            # If every alert has been suppressed because it was already treated,
            # never expose a CRITICAL/70+ result with no visible risk.
            if suppressed_alerts:
                severity = "info"
                risk_score = min(risk_score, 30.0)
            priority = "low"
            summary = "Aucune anomalie détectée."
            next_action = ""

        _score_changed = round(risk_score, 2) != round(ml_risk_score, 2)
        _severity_changed = severity != ml_severity
        if _score_changed or _severity_changed:
            triggered = []
            if _critical_count >= 2:
                triggered.append("double_critical_floor_85")
            elif _has_critical_rule:
                triggered.append("critical_floor_70")
            elif _has_warning_rule:
                triggered.append("warning_floor_36")
            if suppressed_alerts and not predicted_risks:
                triggered.append("all_alerts_suppressed_force_info")
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
            rule_override = {
                "applied": False,
                "ml_severity": ml_severity,
                "ml_risk_score": round(ml_risk_score, 2),
            }

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
        prediction["maintenance_filter"] = {
            "applied": bool(suppressed_alerts),
            "suppressed_alerts": suppressed_alerts,
        }
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
