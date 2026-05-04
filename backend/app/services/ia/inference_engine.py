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

        for col in feature_names:
            if col not in featured.columns:
                featured[col] = 0.0

        X = featured[feature_names].copy() if feature_names else featured.select_dtypes(include=["number"]).copy()
        X = X.apply(pd.to_numeric, errors="coerce")
        X = X.fillna(X.median(numeric_only=True)).fillna(0.0)
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

        return {
            "vehicle_id": normalized["vehicle_id"],
            "generated_at": datetime.now(timezone.utc),
            "source": "ml_model",
            "model_family": f"{metadata['classifier_name']} + {metadata['regressor_name']}",
            "predicted_severity": predicted_severity,
            "predicted_risk_score": predicted_risk_score,
            "confidence": confidence,
            "telemetry_window_size": len(window) if window else 1,
            "telemetry_snapshot": {
                key: normalized.get(key) for key in AIInferenceService.SNAPSHOT_KEYS
            },
        }
