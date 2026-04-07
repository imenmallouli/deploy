from __future__ import annotations

from datetime import datetime, timezone
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
    ]

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

        return normalized

    @staticmethod
    def _prepare_features(payload: dict[str, Any]):
        normalized = AIInferenceService._normalize_payload(payload)
        telemetry_df = pd.DataFrame([normalized])
        telemetry_df = clean_telemetry_dataframe(telemetry_df)
        featured = build_telemetry_features(telemetry_df)

        classifier_bundle = load_classifier_bundle()
        feature_names = classifier_bundle.get("feature_names", [])

        for col in feature_names:
            if col not in featured.columns:
                featured[col] = 0.0

        X = featured[feature_names].copy() if feature_names else featured.select_dtypes(include=["number"]).copy()
        X = X.apply(pd.to_numeric, errors="coerce")
        X = X.fillna(X.median(numeric_only=True)).fillna(0.0)
        return normalized, X

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

        return {
            "vehicle_id": normalized["vehicle_id"],
            "generated_at": datetime.now(timezone.utc),
            "source": "ml_model",
            "model_family": f"{metadata['classifier_name']} + {metadata['regressor_name']}",
            "predicted_severity": predicted_severity,
            "predicted_risk_score": predicted_risk_score,
            "confidence": confidence,
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

        if not doc:
            raise LookupError(f"No telemetry found for vehicle_id={vehicle_id}")

        doc.pop("_id", None)
        doc["vehicle_id"] = int(doc.get("vehicle_id") or vehicle_id)
        return doc

    @classmethod
    async def predict_latest_for_vehicle(cls, vehicle_id: int) -> dict[str, Any]:
        payload = await cls.latest_payload_for_vehicle(vehicle_id)
        return cls.predict_from_payload(payload)
