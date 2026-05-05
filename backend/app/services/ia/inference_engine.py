from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any

import pandas as pd

from app.db.mongodb import get_mongo_db
from app.services.ia.data_cleaner import clean_telemetry_dataframe
from app.services.ia.feature_engineering import build_telemetry_features
from app.services.ia.model_loader import (
    get_model_metadata,
    load_classifier_bundle,
    load_regressor_bundle,
)


class AIInferenceService:
    PAYLOAD_DTC_CATALOG = {
        "P0300": {
            "description": "Rates d'allumage detectes (cylindres multiples)",
            "severity": "critical",
            "recommended_action": "Verifier bobines, bougies et systeme d'allumage.",
        },
        "P0420": {
            "description": "Efficacite du catalyseur sous le seuil",
            "severity": "warning",
            "recommended_action": "Controler catalyseur, sonde lambda et combustion moteur.",
        },
        "P0171": {
            "description": "Melange trop pauvre",
            "severity": "warning",
            "recommended_action": "Verifier admission d'air, injecteurs et capteur MAF.",
        },
        "P0101": {
            "description": "Capteur MAF hors plage",
            "severity": "warning",
            "recommended_action": "Nettoyer ou remplacer le capteur MAF.",
        },
        "P0113": {
            "description": "Capteur temperature air admission signal haut",
            "severity": "warning",
            "recommended_action": "Verifier capteur d'admission et faisceau.",
        },
        "P0562": {
            "description": "Tension systeme faible",
            "severity": "critical",
            "recommended_action": "Controler batterie, alternateur et circuit de charge.",
        },
        "P0401": {
            "description": "Debit EGR insuffisant",
            "severity": "info",
            "recommended_action": "Verifier vanne EGR et conduits associes.",
        },
        "P0455": {
            "description": "Fuite EVAP importante detectee",
            "severity": "info",
            "recommended_action": "Verifier bouchon de reservoir et circuit EVAP.",
        },
        "P0217": {
            "description": "Temperature moteur trop elevee",
            "severity": "critical",
            "recommended_action": "Verifier liquide de refroidissement, radiateur et ventilateur.",
        },
        "P0500": {
            "description": "Capteur vitesse vehicule defaillant",
            "severity": "warning",
            "recommended_action": "Verifier capteur vitesse et cablage associe.",
        },
        "P0605": {
            "description": "Erreur interne ROM calculateur moteur",
            "severity": "critical",
            "recommended_action": "Diagnostiquer le calculateur moteur rapidement.",
        },
    }

    SNAPSHOT_KEYS = [
        "speed",
        "rpm",
        "fuel_level",
        "engine_temp",
        "battery_voltage",
        "engine_load",
        "ambient_air_temp",
        "intake_temp",
        "odometer",
        "temp_cpu",
        "cpu",
        "gpu",
    ]
    MAINTENANCE_KEYS = [
        "last_oil_change_odometer",
        "oil_change_interval_km",
        "last_maintenance_odometer",
        "maintenance_interval_km",
        "last_major_parts_change_odometer",
        "major_parts_interval_km",
    ]

    @staticmethod
    def _normalize_maintenance_records(payload: dict[str, Any]) -> list[dict[str, Any]]:
        raw_records = payload.get("maintenance_records") or []
        normalized_records: list[dict[str, Any]] = []
        if not isinstance(raw_records, list):
            return normalized_records

        for item in raw_records:
            if not isinstance(item, dict):
                continue

            component = str(item.get("component") or "").strip().lower()
            if not component:
                continue

            try:
                serviced_at_odometer = float(item.get("serviced_at_odometer")) if item.get("serviced_at_odometer") is not None else None
            except (TypeError, ValueError):
                serviced_at_odometer = None

            try:
                valid_for_km = float(item.get("valid_for_km")) if item.get("valid_for_km") is not None else 3000.0
            except (TypeError, ValueError):
                valid_for_km = 3000.0

            resolved_dtc_codes = []
            for code in item.get("resolved_dtc_codes") or []:
                code_str = str(code).strip().upper()
                if code_str:
                    resolved_dtc_codes.append(code_str)

            normalized_records.append(
                {
                    "component": component,
                    "serviced_at_odometer": serviced_at_odometer,
                    "valid_for_km": max(0.0, valid_for_km),
                    "resolved_dtc_codes": resolved_dtc_codes,
                    "note": str(item.get("note") or "").strip(),
                }
            )

        return normalized_records

    @staticmethod
    def _infer_payload_dtc_severity(code: str, description: str) -> str:
        text = f"{code} {description}".lower()
        if any(token in text for token in ["surchauffe", "temperature moteur trop elevee", "tension systeme faible", "erreur interne", "rates d'allumage"]):
            return "critical"
        if any(token in text for token in ["hors plage", "capteur", "fuite", "efficacite", "melange trop pauvre"]):
            return "warning"
        return "info"

    @classmethod
    def _build_payload_dtc_events(cls, payload: dict[str, Any]) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        for raw_code in payload.get("active_dtc_codes") or []:
            code = str(raw_code).strip().upper()
            if not code:
                continue
            meta = cls.PAYLOAD_DTC_CATALOG.get(code, {})
            description = str(meta.get("description") or "Code defaut detecte")
            severity = str(meta.get("severity") or cls._infer_payload_dtc_severity(code, description)).lower()
            if severity not in {"info", "warning", "critical"}:
                severity = "warning"
            events.append(
                {
                    "code": code,
                    "description": description,
                    "severity": severity,
                    "category": "payload_dtc",
                    "recommended_action": meta.get("recommended_action") or f"Diagnostiquer le code {code} et corriger la cause racine.",
                    "occurrence_count": 1,
                    "last_occurrence": payload.get("ts"),
                }
            )
        return events

    @staticmethod
    async def _latest_active_dtc_for_vehicle(vehicle_id: int, limit: int = 5) -> list[dict[str, Any]]:
        """Return unresolved DTC events for a vehicle, most recent first."""
        db = get_mongo_db()
        cursor = db.dtc_events.find(
            {
                "vehicle_id": vehicle_id,
                "$or": [{"resolved": False}, {"resolved": {"$exists": False}}],
            }
        ).sort([("last_occurrence", -1), ("_id", -1)]).limit(limit)

        docs = await cursor.to_list(length=limit)
        events: list[dict[str, Any]] = []
        for doc in docs:
            events.append(
                {
                    "code": doc.get("code") or doc.get("dtc_code"),
                    "description": doc.get("description"),
                    "severity": str(doc.get("severity") or "warning").lower(),
                    "category": doc.get("category"),
                    "recommended_action": doc.get("recommended_action"),
                    "occurrence_count": doc.get("occurrence_count"),
                    "last_occurrence": doc.get("last_occurrence") or doc.get("created_at"),
                }
            )
        return events

    @staticmethod
    async def _fetch_maintenance_records_for_vehicle(vehicle_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """Fetch recent maintenance records from MongoDB for a vehicle.
        
        Returns the most recent maintenance records sorted by serviced_at_odometer (descending),
        which will be used to suppress alerts for already-serviced components.
        """
        db = get_mongo_db()
        cursor = db.maintenance_records.find(
            {"vehicle_id": vehicle_id}
        ).sort([("serviced_at_odometer", -1)]).limit(limit)

        docs = await cursor.to_list(length=limit)
        records: list[dict[str, Any]] = []
        for doc in docs:
            doc.pop("_id", None)
            doc["vehicle_id"] = int(doc.get("vehicle_id") or vehicle_id)
            
            # Normalize the record structure to match AIMaintenanceRecord schema
            normalized_record = {
                "component": str(doc.get("component") or "").strip().lower(),
                "serviced_at_odometer": float(doc.get("serviced_at_odometer")) if doc.get("serviced_at_odometer") is not None else None,
                "valid_for_km": float(doc.get("valid_for_km")) if doc.get("valid_for_km") is not None else 3000.0,
                "resolved_dtc_codes": [str(code).strip().upper() for code in (doc.get("resolved_dtc_codes") or [])],
                "note": str(doc.get("note") or "").strip(),
            }
            
            # Only include records that have required fields
            if normalized_record["component"] and normalized_record["serviced_at_odometer"] is not None:
                records.append(normalized_record)
        
        return records

    @staticmethod
    def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(payload)
        normalized["vehicle_id"] = int(normalized.get("vehicle_id") or 0)
        normalized["plate"] = normalized.get("plate") or f"VEH-{normalized['vehicle_id']}"

        ts = normalized.get("ts") or datetime.now(timezone.utc)
        if isinstance(ts, datetime) and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        normalized["ts"] = ts

        for key in AIInferenceService.SNAPSHOT_KEYS:
            value = normalized.get(key)
            if value is None:
                normalized[key] = None
                continue
            try:
                normalized[key] = float(value)
            except (TypeError, ValueError):
                normalized[key] = None

        for key in AIInferenceService.MAINTENANCE_KEYS:
            value = normalized.get(key)
            if value is None:
                normalized[key] = None
                continue
            try:
                normalized[key] = float(value)
            except (TypeError, ValueError):
                normalized[key] = None

        normalized["maintenance_records"] = AIInferenceService._normalize_maintenance_records(payload)

        return normalized

    @staticmethod
    def _prepare_features(payload: dict[str, Any]):
        """Build features from a single payload snapshot.

        NOTE: Rolling features (mean_3, mean_12, delta) collapse to the raw
        value when only one row is available.  Use _prepare_features_from_window
        for vehicle-level predictions where historical rows can be fetched.
        """
        normalized = AIInferenceService._normalize_payload(payload)
        telemetry_df = pd.DataFrame([normalized])
        telemetry_df = clean_telemetry_dataframe(telemetry_df)
        featured = build_telemetry_features(telemetry_df)

        classifier_bundle = load_classifier_bundle()
        feature_names = classifier_bundle.get("feature_names", [])

        missing_cols = [col for col in feature_names if col not in featured.columns]
        if missing_cols:
            featured = pd.concat(
                [featured, pd.DataFrame(0.0, index=featured.index, columns=missing_cols)],
                axis=1,
            )

        X = featured[feature_names].copy() if feature_names else featured.select_dtypes(include=["number"]).copy()
        X = X.apply(pd.to_numeric, errors="coerce")
        X = X.fillna(X.median(numeric_only=True)).fillna(0.0)

        # Inject active DTC code features if caller provides them in payload.
        active_codes = payload.get("active_dtc_codes") or []
        if active_codes:
            import re as _re
            active_dtc_count = 0
            for code in active_codes:
                raw = str(code).strip().upper()
                cleaned = _re.sub(r"[^A-Z0-9]+", "_", raw).strip("_") or "UNKNOWN"
                col = f"dtc_code_{cleaned}"
                if col in X.columns:
                    X[col] = 1.0
                    active_dtc_count += 1
            if "active_dtc_count" in X.columns:
                X["active_dtc_count"] = float(active_dtc_count)
            if "max_dtc_severity" in X.columns:
                X["max_dtc_severity"] = 2.0  # assume critical when codes passed explicitly

        return normalized, X

    @staticmethod
    def _prepare_features_from_window(payloads: list[dict[str, Any]]):
        """Build features from an ordered window of telemetry records.

        Rolling features (mean_3, mean_12, delta) are computed over the full
        window so the last row has a meaningful history — matching how the model
        was trained.  Only the last row is returned for prediction.
        """
        if not payloads:
            raise ValueError("_prepare_features_from_window requires at least one payload row.")

        normalized_rows = [AIInferenceService._normalize_payload(p) for p in payloads]
        telemetry_df = pd.DataFrame(normalized_rows)
        telemetry_df = clean_telemetry_dataframe(telemetry_df)
        featured = build_telemetry_features(telemetry_df)

        # Keep only the latest record for inference
        last_normalized = normalized_rows[-1]
        featured_last = featured.iloc[[-1]].copy()

        classifier_bundle = load_classifier_bundle()
        feature_names = classifier_bundle.get("feature_names", [])

        for col in feature_names:
            if col not in featured_last.columns:
                featured_last[col] = 0.0

        X = featured_last[feature_names].copy() if feature_names else featured_last.select_dtypes(include=["number"]).copy()
        X = X.apply(pd.to_numeric, errors="coerce")
        X = X.fillna(X.median(numeric_only=True)).fillna(0.0)
        return last_normalized, X

    @staticmethod
    def predict_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
        normalized, X = AIInferenceService._prepare_features(payload)

        classifier_bundle = load_classifier_bundle()
        regressor_bundle = load_regressor_bundle()
        classifier = classifier_bundle["model"]
        regressor = regressor_bundle["model"]
        metadata = get_model_metadata()

        predicted_severity = str(classifier.predict(X)[0])
        predicted_risk_score = float(regressor.predict(X)[0])
        predicted_risk_score = round(max(0.0, min(100.0, predicted_risk_score)), 2)

        confidence = None
        if hasattr(classifier, "predict_proba"):
            probabilities = classifier.predict_proba(X)[0]
            confidence = round(float(max(probabilities) * 100), 2)

        active_dtc_events = AIInferenceService._build_payload_dtc_events(payload)

        return {
            "vehicle_id": normalized["vehicle_id"],
            "generated_at": datetime.now(timezone.utc),
            "source": "ml_model",
            "model_family": f"{metadata['classifier_name']} + {metadata['regressor_name']}",
            "predicted_severity": predicted_severity,
            "predicted_risk_score": predicted_risk_score,
            "confidence": confidence,
            "active_dtc_events": active_dtc_events,
            "maintenance_context": {
                key: normalized.get(key) for key in AIInferenceService.MAINTENANCE_KEYS
            },
            "maintenance_records": normalized.get("maintenance_records", []),
            "telemetry_snapshot": {
                key: normalized.get(key) for key in AIInferenceService.SNAPSHOT_KEYS
            },
        }

    @staticmethod
    async def latest_payload_for_vehicle(vehicle_id: int) -> dict[str, Any]:
        db = get_mongo_db()
        doc = await db.telemetry_data.find_one(
            {"vehicle_id": vehicle_id},
            sort=[("ts", -1)],
        )

        if doc:
            doc.pop("_id", None)
            doc["vehicle_id"] = int(doc.get("vehicle_id") or vehicle_id)
            return doc

        # Fallback: if no telemetry is available yet, predict from a minimal vehicle snapshot
        # so AI endpoints remain usable right after vehicle creation.
        from app.db.session import SessionLocal
        from app.models.vehicle import Vehicle

        sql_db = SessionLocal()
        try:
            vehicle = sql_db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        finally:
            sql_db.close()

        if not vehicle:
            raise LookupError(f"Vehicle not found for vehicle_id={vehicle_id}")

        return {
            "vehicle_id": int(vehicle_id),
            "plate": vehicle.license_plate,
            "ts": datetime.now(timezone.utc),
            "speed": None,
            "rpm": None,
            "fuel_level": None,
            "engine_temp": None,
            "battery_voltage": None,
            "engine_load": None,
            "ambient_air_temp": None,
            "intake_temp": None,
            "odometer": float(vehicle.mileage) if vehicle.mileage is not None else None,
            "temp_cpu": None,
            "cpu": None,
            "gpu": None,
        }

    @staticmethod
    async def latest_window_for_vehicle(vehicle_id: int, window: int = 12) -> list[dict[str, Any]]:
        """Return the last *window* telemetry records for *vehicle_id*, oldest first.

        This window is used to compute rolling features at inference time,
        eliminating the training/serving skew that occurs when only a single
        snapshot is available (in which case rolling(3) == rolling(12) == raw value).
        """
        db = get_mongo_db()
        cursor = db.telemetry_data.find(
            {"vehicle_id": vehicle_id},
            sort=[("ts", -1)],
            limit=window,
        )
        docs = await cursor.to_list(length=window)
        if not docs:
            return []
        # Reverse so records are in chronological order (oldest first)
        docs.reverse()
        for doc in docs:
            doc.pop("_id", None)
            doc["vehicle_id"] = int(doc.get("vehicle_id") or vehicle_id)
        return docs

    @classmethod
    async def predict_latest_for_vehicle(cls, vehicle_id: int) -> dict[str, Any]:
        """Predict using a rolling window of telemetry to avoid serving skew.

        Fetches the last 12 records so that rolling features (mean_3, mean_12,
        delta) are meaningful at inference — exactly as they were at training time.
        Falls back to a single snapshot (or vehicle defaults) when no telemetry
        exists yet.
        """
        window = await cls.latest_window_for_vehicle(vehicle_id, window=12)
        if len(window) >= 2:
            normalized, X = cls._prepare_features_from_window(window)
        elif len(window) == 1:
            normalized, X = cls._prepare_features(window[0])
        else:
            # No telemetry at all — fall back to vehicle metadata
            payload = await cls.latest_payload_for_vehicle(vehicle_id)
            normalized, X = cls._prepare_features(payload)

        classifier_bundle = load_classifier_bundle()
        regressor_bundle = load_regressor_bundle()
        classifier = classifier_bundle["model"]
        regressor = regressor_bundle["model"]
        metadata = get_model_metadata()

        predicted_severity = str(classifier.predict(X)[0])
        predicted_risk_score = float(regressor.predict(X)[0])
        predicted_risk_score = round(max(0.0, min(100.0, predicted_risk_score)), 2)

        confidence = None
        if hasattr(classifier, "predict_proba"):
            probabilities = classifier.predict_proba(X)[0]
            confidence = round(float(max(probabilities) * 100), 2)

        active_dtc_events = await cls._latest_active_dtc_for_vehicle(vehicle_id=normalized["vehicle_id"], limit=5)
        
        # Fetch maintenance records from database for this vehicle
        maintenance_records = await cls._fetch_maintenance_records_for_vehicle(vehicle_id=normalized["vehicle_id"], limit=10)

        return {
            "vehicle_id": normalized["vehicle_id"],
            "generated_at": datetime.now(timezone.utc),
            "source": "ml_model",
            "model_family": f"{metadata['classifier_name']} + {metadata['regressor_name']}",
            "predicted_severity": predicted_severity,
            "predicted_risk_score": predicted_risk_score,
            "confidence": confidence,
            "telemetry_window_size": len(window) if window else 1,
            "active_dtc_events": active_dtc_events,
            "maintenance_context": {
                key: normalized.get(key) for key in AIInferenceService.MAINTENANCE_KEYS
            },
            "maintenance_records": maintenance_records,
            "telemetry_snapshot": {
                key: normalized.get(key) for key in AIInferenceService.SNAPSHOT_KEYS
            },
        }
