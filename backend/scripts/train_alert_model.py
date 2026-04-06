from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.ia.data_cleaner import clean_label_dataframe, clean_telemetry_dataframe
from app.services.ia.feature_engineering import build_telemetry_features
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = DATA_DIR / "models"
CLASSIFIER_PATH = MODELS_DIR / "severity_classifier.joblib"
REGRESSOR_PATH = MODELS_DIR / "risk_regressor.joblib"
METRICS_PATH = MODELS_DIR / "training_metrics.json"


def resolve_dataset_path() -> Path:
    candidates = sorted(DATA_DIR.glob("sample_dataset*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise FileNotFoundError(f"No dataset found in: {DATA_DIR}")
    return candidates[0]


def load_training_dataset() -> pd.DataFrame:
    dataset_path = resolve_dataset_path()
    print(f"Using dataset: {dataset_path}")

    telemetry = pd.read_excel(dataset_path, sheet_name="telemetry_data")
    labels = pd.read_excel(dataset_path, sheet_name="ai_labels")

    telemetry = clean_telemetry_dataframe(telemetry)
    labels = clean_label_dataframe(labels)

    engineered = build_telemetry_features(telemetry)
    feature_only_cols = [
        col for col in engineered.columns
        if col not in labels.columns and col not in {"device_id", "ambient_air_temp", "intake_temp", "odometer"}
    ]

    merged = labels.merge(
        engineered[["vehicle_id", "plate", "ts", *feature_only_cols]],
        on=["vehicle_id", "plate", "ts"],
        how="left",
    )

    return merged.sort_values(["vehicle_id", "ts"]).reset_index(drop=True)


def prepare_xy(df: pd.DataFrame):
    feature_cols = [
        "speed",
        "rpm",
        "engine_temp",
        "battery_voltage",
        "fuel_level",
        "engine_load",
        "speed_mean_3",
        "speed_mean_12",
        "rpm_mean_3",
        "rpm_mean_12",
        "engine_temp_mean_3",
        "engine_temp_mean_12",
        "battery_voltage_mean_3",
        "battery_voltage_mean_12",
        "engine_load_mean_3",
        "engine_load_mean_12",
        "fuel_level_mean_3",
        "fuel_level_mean_12",
        "battery_voltage_delta",
        "engine_temp_delta",
        "fuel_level_delta",
        "is_idling",
        "is_overheating",
        "is_battery_low",
        "is_low_fuel",
        "is_engine_overload",
        "high_rpm_flag",
        "idle_duration_min",
    ]

    available = [col for col in feature_cols if col in df.columns]
    X = df[available].copy()
    X = X.apply(pd.to_numeric, errors="coerce")
    X = X.fillna(X.median(numeric_only=True)).fillna(0)

    y_class = df["severity"].astype(str)
    y_reg = pd.to_numeric(df["risk_score"], errors="coerce").fillna(0)
    return X, y_class, y_reg, available


def train_models(df: pd.DataFrame) -> dict:
    X, y_class, y_reg, feature_names = prepare_xy(df)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    metrics: dict[str, object] = {
        "dataset_rows": int(len(df)),
        "severity_distribution": y_class.value_counts().to_dict(),
        "feature_count": len(feature_names),
        "features": feature_names,
    }

    if y_class.nunique() > 1:
        stratify = y_class if y_class.value_counts().min() >= 2 else None
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_class, test_size=0.2, random_state=42, stratify=stratify
        )

        clf = RandomForestClassifier(
            n_estimators=250,
            max_depth=10,
            min_samples_leaf=2,
            random_state=42,
            class_weight="balanced",
        )
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_test)

        class_metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "classification_report": classification_report(y_test, y_pred, output_dict=True, zero_division=0),
        }
        metrics["classification"] = class_metrics
        joblib.dump({
            "model": clf,
            "feature_names": feature_names,
            "classes": clf.classes_.tolist(),
        }, CLASSIFIER_PATH)
    else:
        metrics["classification"] = {"skipped": True, "reason": "Only one severity class present in the dataset."}

    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
        X, y_reg, test_size=0.2, random_state=42
    )
    reg = RandomForestRegressor(
        n_estimators=250,
        max_depth=10,
        min_samples_leaf=2,
        random_state=42,
    )
    reg.fit(X_train_r, y_train_r)
    y_pred_r = reg.predict(X_test_r)

    reg_metrics = {
        "mae": float(mean_absolute_error(y_test_r, y_pred_r)),
        "r2": float(r2_score(y_test_r, y_pred_r)),
    }
    metrics["regression"] = reg_metrics
    joblib.dump({"model": reg, "feature_names": feature_names}, REGRESSOR_PATH)

    with METRICS_PATH.open("w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2, ensure_ascii=False)

    return metrics


def main():
    print("⏳ Loading dataset and running preprocessing...")
    dataset = load_training_dataset()
    metrics = train_models(dataset)

    print("\n✅ Training completed")
    print(f"Dataset rows: {metrics['dataset_rows']}")
    print(f"Severity distribution: {metrics['severity_distribution']}")

    classification = metrics.get("classification", {})
    if not classification.get("skipped"):
        print(f"Classifier accuracy: {classification['accuracy']:.4f}")
    else:
        print(f"Classifier skipped: {classification['reason']}")

    regression = metrics["regression"]
    print(f"Risk MAE: {regression['mae']:.4f}")
    print(f"Risk R²: {regression['r2']:.4f}")
    print(f"Saved: {CLASSIFIER_PATH}")
    print(f"Saved: {REGRESSOR_PATH}")
    print(f"Saved: {METRICS_PATH}")


if __name__ == "__main__":
    main()
