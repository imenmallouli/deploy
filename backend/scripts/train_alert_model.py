from __future__ import annotations

import json
import math
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
import re

import joblib
import pandas as pd
from imblearn.over_sampling import RandomOverSampler, SMOTE
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error, r2_score, recall_score
from sklearn.model_selection import StratifiedKFold

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


def get_training_status() -> dict:
    classifier_exists = CLASSIFIER_PATH.exists()
    regressor_exists = REGRESSOR_PATH.exists()
    metrics_exists = METRICS_PATH.exists()
    trained = classifier_exists and regressor_exists and metrics_exists

    latest_artifact = None
    artifacts = [path for path in [CLASSIFIER_PATH, REGRESSOR_PATH, METRICS_PATH] if path.exists()]
    if artifacts:
        latest_artifact = datetime.fromtimestamp(max(path.stat().st_mtime for path in artifacts)).isoformat()

    return {
        "trained": trained,
        "classifier_exists": classifier_exists,
        "regressor_exists": regressor_exists,
        "metrics_exists": metrics_exists,
        "last_artifact_update": latest_artifact,
    }


def split_train_val_test_temporal(X: pd.DataFrame, y: pd.Series, ts_series: pd.Series):
    """Chronological 60/20/20 split to avoid temporal leakage."""
    if len(X) != len(y) or len(X) != len(ts_series):
        raise ValueError("X, y and ts_series must have the same length.")

    if len(X) < 5:
        raise ValueError("Not enough rows to build temporal train/val/test split.")

    ts_dt = pd.to_datetime(ts_series, errors="coerce")
    # Stable ordering preserves relative order for identical timestamps.
    order = ts_dt.sort_values(kind="mergesort", na_position="last").index

    X_ordered = X.loc[order].reset_index(drop=True)
    y_ordered = y.loc[order].reset_index(drop=True)

    n = len(X_ordered)
    i1 = int(n * 0.60)
    i2 = int(n * 0.80)
    i1 = max(1, min(i1, n - 2))
    i2 = max(i1 + 1, min(i2, n - 1))

    X_train = X_ordered.iloc[:i1].copy()
    X_val = X_ordered.iloc[i1:i2].copy()
    X_test = X_ordered.iloc[i2:].copy()
    y_train = y_ordered.iloc[:i1].copy()
    y_val = y_ordered.iloc[i1:i2].copy()
    y_test = y_ordered.iloc[i2:].copy()
    return X_train, X_val, X_test, y_train, y_val, y_test


def resolve_critical_label(y: pd.Series) -> str | None:
    for label in y.astype(str).unique().tolist():
        if label.strip().lower() == "critical":
            return label
    return None


def compute_critical_recall(y_true: pd.Series, y_pred: pd.Series, critical_label: str | None) -> float | None:
    if critical_label is None or critical_label not in y_true.astype(str).unique().tolist():
        return None
    y_true_bin = y_true.astype(str) == critical_label
    y_pred_bin = pd.Series(y_pred).astype(str) == critical_label
    return float(recall_score(y_true_bin, y_pred_bin, zero_division=0))


def balance_training_classes(X_train: pd.DataFrame, y_train: pd.Series):
    class_counts = y_train.value_counts()
    target_count = int(class_counts.max())

    # If classes are already balanced, skip augmentation.
    if class_counts.nunique() == 1:
        return X_train, y_train, {"applied": False, "method": None, "reason": "classes already balanced"}

    sampling_strategy = {label: target_count for label, count in class_counts.items() if int(count) < target_count}
    if not sampling_strategy:
        return X_train, y_train, {"applied": False, "method": None, "reason": "nothing to resample"}

    min_class_count = int(class_counts.min())
    if min_class_count >= 2:
        sampler = SMOTE(
            sampling_strategy=sampling_strategy,
            k_neighbors=min(5, min_class_count - 1),
            random_state=42,
        )
        method = "smote"
    else:
        sampler = RandomOverSampler(
            sampling_strategy=sampling_strategy,
            random_state=42,
        )
        method = "random_over_sampler"

    X_res, y_res = sampler.fit_resample(X_train, y_train)
    return X_res, y_res, {
        "applied": True,
        "method": method,
        "counts_before": {str(k): int(v) for k, v in class_counts.to_dict().items()},
        "counts_after": {str(k): int(v) for k, v in pd.Series(y_res).value_counts().to_dict().items()},
        "target_count": target_count,
    }


def evaluate_classification_candidates_cv(
    X: pd.DataFrame,
    y: pd.Series,
    candidates: dict[str, Any],
    critical_label: str | None,
) -> tuple[str, list[dict], dict[str, object]]:
    min_class_count = int(y.value_counts().min())
    n_splits = max(2, min(5, min_class_count))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

    model_summaries: list[dict] = []
    best_name = ""
    best_score = float("-inf")

    for candidate_name, candidate_model in candidates.items():
        fold_scores = []
        balance_events = []
        for train_idx, val_idx in cv.split(X, y):
            X_train_fold = X.iloc[train_idx]
            y_train_fold = y.iloc[train_idx]
            X_val_fold = X.iloc[val_idx]
            y_val_fold = y.iloc[val_idx]

            X_train_balanced, y_train_balanced, balance_meta = balance_training_classes(X_train_fold, y_train_fold)
            balance_events.append(balance_meta)

            candidate_model.fit(X_train_balanced, y_train_balanced)
            val_pred = candidate_model.predict(X_val_fold)
            val_report = classification_report(y_val_fold, val_pred, output_dict=True, zero_division=0)
            fold_scores.append(
                {
                    "accuracy": float(accuracy_score(y_val_fold, val_pred)),
                    "f1_macro": float(val_report["macro avg"]["f1-score"]),
                    "critical_recall": compute_critical_recall(y_val_fold, val_pred, critical_label),
                }
            )

        valid_critical = [s["critical_recall"] for s in fold_scores if s["critical_recall"] is not None]
        mean_critical_recall = float(sum(valid_critical) / len(valid_critical)) if valid_critical else None
        mean_f1_macro = float(sum(s["f1_macro"] for s in fold_scores) / len(fold_scores))
        mean_accuracy = float(sum(s["accuracy"] for s in fold_scores) / len(fold_scores))

        summary = {
            "model": candidate_name,
            "cv_folds": n_splits,
            "cv_mean_accuracy": mean_accuracy,
            "cv_mean_f1_macro": mean_f1_macro,
            "cv_mean_critical_recall": mean_critical_recall,
            "cv_selection_score": None,
            "resampling": balance_events,
        }

        recall_for_score = mean_critical_recall if mean_critical_recall is not None else 0.0
        # Balanced objective: prioritize global quality while preserving critical detection.
        selection_score = (0.50 * mean_accuracy) + (0.25 * mean_f1_macro) + (0.25 * recall_for_score)
        summary["cv_selection_score"] = float(selection_score)
        model_summaries.append(summary)

        if selection_score > best_score:
            best_score = selection_score
            best_name = candidate_name

    cv_meta = {
        "strategy": "StratifiedKFold",
        "n_splits": n_splits,
        "selection_priority": ["cv_selection_score", "cv_mean_accuracy", "cv_mean_critical_recall"],
    }
    return best_name, model_summaries, cv_meta


def resolve_dataset_path() -> Path:
    # Always use the newest generated dataset file.
    # This avoids training on a stale sample_dataset.xlsx when Excel locked it
    # and generate_sample_dataset.py produced a timestamped variant.
    candidates = sorted(DATA_DIR.glob("sample_dataset*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise FileNotFoundError(f"No dataset found in: {DATA_DIR}")
    return candidates[0]


def temporal_holdout_indices(df: pd.DataFrame, test_ratio: float = 0.2):
    """Build train/test indices where test only contains later timestamps."""
    if "ts" not in df.columns or df.empty:
        return None

    ts = pd.to_datetime(df["ts"], errors="coerce")
    valid_mask = ts.notna()
    if int(valid_mask.sum()) < 10:
        return None

    ordered_valid_idx = ts[valid_mask].sort_values().index.tolist()
    split_at = int(len(ordered_valid_idx) * (1 - test_ratio))
    split_at = max(1, min(split_at, len(ordered_valid_idx) - 1))

    train_idx = ordered_valid_idx[:split_at]
    test_idx = ordered_valid_idx[split_at:]
    if not train_idx or not test_idx:
        return None

    return {
        "train_idx": train_idx,
        "test_idx": test_idx,
        "train_end_ts": ts.loc[train_idx].max(),
        "test_start_ts": ts.loc[test_idx].min(),
    }


def _severity_to_num(value: Any) -> int:
    if value is None:
        return 1
    as_str = str(value).strip().lower()
    if as_str in {"0", "info", "low"}:
        return 0
    if as_str in {"2", "critical", "high", "error"}:
        return 2
    if as_str in {"1", "warning", "medium", "warn"}:
        return 1
    try:
        as_int = int(float(as_str))
        return max(0, min(2, as_int))
    except (TypeError, ValueError):
        return 1


def build_dtc_context_features(labels: pd.DataFrame, dtc_records: pd.DataFrame) -> pd.DataFrame:
    """Build per-row DTC context aligned with labels timestamps.

    Features:
    - active_dtc_count: number of active DTC events at label timestamp
    - max_dtc_severity: max active severity (0=info,1=warning,2=critical)
    """
    base = labels[["vehicle_id", "ts"]].copy()
    base["active_dtc_count"] = 0
    base["max_dtc_severity"] = 0

    if dtc_records.empty:
        return base

    dtc = dtc_records.copy()
    if "vehicle_id" not in dtc.columns:
        return base

    first_col = "first_detected" if "first_detected" in dtc.columns else "created_at"
    last_col = "last_occurrence" if "last_occurrence" in dtc.columns else first_col

    dtc[first_col] = pd.to_datetime(dtc[first_col], errors="coerce")
    dtc[last_col] = pd.to_datetime(dtc[last_col], errors="coerce")
    dtc["severity_num"] = dtc.get("severity", pd.Series(index=dtc.index, dtype=object)).map(_severity_to_num)
    dtc["resolved"] = dtc.get("resolved", False).fillna(False).astype(bool)
    dtc["last_active_ts"] = dtc[last_col].where(dtc["resolved"], pd.NaT)

    for vehicle_id, label_idx in base.groupby("vehicle_id").groups.items():
        vehicle_labels = base.loc[label_idx]
        vehicle_dtc = dtc[dtc["vehicle_id"] == vehicle_id]
        if vehicle_dtc.empty:
            continue

        for idx, ts in vehicle_labels["ts"].items():
            if pd.isna(ts):
                continue
            started = vehicle_dtc[first_col].notna() & (vehicle_dtc[first_col] <= ts)
            still_open = (~vehicle_dtc["resolved"]) | vehicle_dtc["last_active_ts"].isna() | (vehicle_dtc["last_active_ts"] >= ts)
            active = vehicle_dtc[started & still_open]
            if active.empty:
                continue

            base.at[idx, "active_dtc_count"] = int(len(active))
            base.at[idx, "max_dtc_severity"] = int(active["severity_num"].max())

    return base


def _safe_dtc_col_name(code: Any) -> str:
    raw = str(code).strip().upper()
    cleaned = re.sub(r"[^A-Z0-9]+", "_", raw)
    cleaned = cleaned.strip("_")
    if not cleaned:
        cleaned = "UNKNOWN"
    return f"dtc_code_{cleaned}"


def build_dtc_code_features(labels: pd.DataFrame, dtc_records: pd.DataFrame) -> pd.DataFrame:
    """Build binary features for each active DTC code at label timestamps."""
    if dtc_records.empty or labels.empty:
        return pd.DataFrame(index=labels.index)

    dtc = dtc_records.copy()
    if "vehicle_id" not in dtc.columns:
        return pd.DataFrame(index=labels.index)

    code_col = "code" if "code" in dtc.columns else ("dtc_code" if "dtc_code" in dtc.columns else None)
    if code_col is None:
        return pd.DataFrame(index=labels.index)

    dtc[code_col] = dtc[code_col].astype(str).str.strip().str.upper()
    dtc = dtc[dtc[code_col] != ""]
    if dtc.empty:
        return pd.DataFrame(index=labels.index)

    unique_codes = sorted(dtc[code_col].dropna().unique().tolist())
    if not unique_codes:
        return pd.DataFrame(index=labels.index)

    code_to_col = {}
    used_cols: set[str] = set()
    for code in unique_codes:
        base_col = _safe_dtc_col_name(code)
        col_name = base_col
        idx = 2
        while col_name in used_cols:
            col_name = f"{base_col}_{idx}"
            idx += 1
        code_to_col[code] = col_name
        used_cols.add(col_name)

    first_col = "first_detected" if "first_detected" in dtc.columns else "created_at"
    last_col = "last_occurrence" if "last_occurrence" in dtc.columns else first_col
    dtc[first_col] = pd.to_datetime(dtc[first_col], errors="coerce")
    dtc[last_col] = pd.to_datetime(dtc[last_col], errors="coerce")
    dtc["resolved"] = dtc.get("resolved", False).fillna(False).astype(bool)
    dtc["last_active_ts"] = dtc[last_col].where(dtc["resolved"], pd.NaT)

    dtc_features = pd.DataFrame(0, index=labels.index, columns=sorted(used_cols), dtype="int8")
    base = labels[["vehicle_id", "ts"]].copy()

    for vehicle_id, label_idx in base.groupby("vehicle_id").groups.items():
        vehicle_labels = base.loc[label_idx]
        vehicle_dtc = dtc[dtc["vehicle_id"] == vehicle_id]
        if vehicle_dtc.empty:
            continue

        for idx, ts in vehicle_labels["ts"].items():
            if pd.isna(ts):
                continue

            started = vehicle_dtc[first_col].notna() & (vehicle_dtc[first_col] <= ts)
            still_open = (~vehicle_dtc["resolved"]) | vehicle_dtc["last_active_ts"].isna() | (vehicle_dtc["last_active_ts"] >= ts)
            active = vehicle_dtc[started & still_open]
            if active.empty:
                continue

            for code in active[code_col].dropna().unique().tolist():
                col = code_to_col.get(code)
                if col is not None:
                    dtc_features.at[idx, col] = 1

    return dtc_features


def load_training_dataset() -> pd.DataFrame:
    dataset_path = resolve_dataset_path()
    print(f"Using dataset: {dataset_path}")

    telemetry = pd.read_excel(dataset_path, sheet_name="telemetry_data")
    labels = pd.read_excel(dataset_path, sheet_name="ai_labels")
    try:
        dtc_records = pd.read_excel(dataset_path, sheet_name="dtc_records")
    except ValueError:
        dtc_records = pd.DataFrame(columns=["vehicle_id", "first_detected", "last_occurrence", "severity", "resolved"])

    telemetry = clean_telemetry_dataframe(telemetry)
    labels = clean_label_dataframe(labels)

    engineered = build_telemetry_features(telemetry)
    feature_only_cols = [
        col for col in engineered.columns
        if col not in labels.columns and col not in {"device_id"}
    ]

    merged = labels.merge(
        engineered[["vehicle_id", "plate", "ts", *feature_only_cols]],
        on=["vehicle_id", "plate", "ts"],
        how="left",
    )

    # Attach DTC context so ML can use reliable OBD-II fault signals.
    merged["ts"] = pd.to_datetime(merged["ts"], errors="coerce")
    dtc_context = build_dtc_context_features(merged[["vehicle_id", "ts"]], dtc_records)
    merged["active_dtc_count"] = pd.to_numeric(dtc_context["active_dtc_count"], errors="coerce").fillna(0).astype(int)
    merged["max_dtc_severity"] = pd.to_numeric(dtc_context["max_dtc_severity"], errors="coerce").fillna(0).astype(int)

    # Add one binary feature per DTC code to train on all known fault codes.
    dtc_code_features = build_dtc_code_features(merged[["vehicle_id", "ts"]], dtc_records)
    if not dtc_code_features.empty:
        merged = pd.concat([merged, dtc_code_features], axis=1)

    return merged.sort_values(["vehicle_id", "ts"]).reset_index(drop=True)


def prepare_xy(df: pd.DataFrame):
    excluded_cols = {
        "vehicle_id",
        "plate",
        "rule_triggered",
        "severity",
        "risk_score",
        "device_id",
    }

    X = df[[col for col in df.columns if col not in excluded_cols]].copy()

    # Add time-derived features (cyclical) while keeping raw timestamp numeric.
    if "ts" in X.columns:
        ts_dt = pd.to_datetime(X["ts"], errors="coerce")
        ts_numeric = ts_dt.astype("int64") / 1_000_000_000
        X["ts"] = ts_numeric.where(ts_numeric > 0)
        hours = ts_dt.dt.hour.fillna(0)
        weekdays = ts_dt.dt.weekday.fillna(0)
        X["hour_sin"] = (hours * (2 * math.pi / 24)).map(math.sin)
        X["hour_cos"] = (hours * (2 * math.pi / 24)).map(math.cos)
        X["weekday_sin"] = (weekdays * (2 * math.pi / 7)).map(math.sin)
        X["weekday_cos"] = (weekdays * (2 * math.pi / 7)).map(math.cos)

    X = X.apply(pd.to_numeric, errors="coerce")
    X = X.fillna(X.median(numeric_only=True)).fillna(0)

    y_class = df["severity"].astype(str)
    y_reg = pd.to_numeric(df["risk_score"], errors="coerce").fillna(0)
    return X, y_class, y_reg, X.columns.tolist()


def train_models(df: pd.DataFrame) -> dict:
    X, y_class, y_reg, feature_names = prepare_xy(df)
    ts_series = pd.to_datetime(df["ts"], errors="coerce")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    before_status = get_training_status()

    metrics: dict[str, object] = {
        "dataset_rows": int(len(df)),
        "severity_distribution": y_class.value_counts().to_dict(),
        "feature_count": len(feature_names),
        "features": feature_names,
        "status_before_training": before_status,
    }

    if y_class.nunique() > 1:
        X_train, X_val, X_test, y_train, y_val, y_test = split_train_val_test_temporal(X, y_class, ts_series)
        X_train_val = pd.concat([X_train, X_val], ignore_index=True)
        y_train_val = pd.concat([y_train, y_val], ignore_index=True)
        critical_label = resolve_critical_label(y_train_val)

        clf_candidates = {
            # max_depth is capped to prevent memorising training noise.
            # Unlimited-depth forests with only 2 dominant features (engine_temp,
            # battery_voltage) produced temporal-holdout MAE jumps of +385 %.
            "shallow": RandomForestClassifier(
                n_estimators=300,
                max_depth=8,
                min_samples_leaf=4,
                max_features="sqrt",
                random_state=42,
                class_weight="balanced",
                n_jobs=-1,
            ),
            "balanced": RandomForestClassifier(
                n_estimators=400,
                max_depth=6,
                min_samples_leaf=10,
                min_samples_split=20,
                max_features="sqrt",
                random_state=42,
                class_weight="balanced_subsample",
                n_jobs=-1,
            ),
        }

        best_clf_name, clf_trials, cv_meta = evaluate_classification_candidates_cv(
            X_train_val,
            y_train_val,
            clf_candidates,
            critical_label,
        )

        clf = clf_candidates[best_clf_name]
        # Évaluation honnête : fit sur train seul, prédit sur test (jamais vu)
        X_train_eval, y_train_eval, _ = balance_training_classes(X_train, y_train)
        clf.fit(X_train_eval, y_train_eval)
        y_pred = clf.predict(X_test)
        critical_recall_test = compute_critical_recall(y_test, y_pred, critical_label)

        class_metrics = {
            "selected_model": best_clf_name,
            "candidates": clf_trials,
            "cross_validation": cv_meta,
            "critical_label": critical_label,
            "split": {
                "train_rows": int(len(X_train)),
                "val_rows": int(len(X_val)),
                "test_rows": int(len(X_test)),
            },
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "critical_recall": critical_recall_test,
            "classification_report": classification_report(y_test, y_pred, output_dict=True, zero_division=0),
        }

        temporal_meta = temporal_holdout_indices(df)
        if temporal_meta is not None:
            X_time_train = X.loc[temporal_meta["train_idx"]]
            y_time_train = y_class.loc[temporal_meta["train_idx"]]
            X_time_test = X.loc[temporal_meta["test_idx"]]
            y_time_test = y_class.loc[temporal_meta["test_idx"]]

            clf_time = clone(clf)
            X_bal, y_bal, _ = balance_training_classes(X_time_train, y_time_train)
            clf_time.fit(X_bal, y_bal)
            y_time_pred = clf_time.predict(X_time_test)
            time_report = classification_report(y_time_test, y_time_pred, output_dict=True, zero_division=0)

            class_metrics["temporal_holdout"] = {
                "train_rows": int(len(X_time_train)),
                "test_rows": int(len(X_time_test)),
                "train_end_ts": temporal_meta["train_end_ts"].isoformat() if temporal_meta["train_end_ts"] is not None else None,
                "test_start_ts": temporal_meta["test_start_ts"].isoformat() if temporal_meta["test_start_ts"] is not None else None,
                "accuracy": float(accuracy_score(y_time_test, y_time_pred)),
                "f1_macro": float(time_report["macro avg"]["f1-score"]),
                "critical_recall": compute_critical_recall(y_time_test, y_time_pred, critical_label),
            }

        metrics["classification"] = class_metrics
        # Refit prod sur train+val (80% des données) — après évaluation honnête
        X_prod = pd.concat([X_train, X_val], ignore_index=True)
        y_prod = pd.concat([y_train, y_val], ignore_index=True)
        X_train_final, y_train_final, final_resampling = balance_training_classes(X_prod, y_prod)
        clf.fit(X_train_final, y_train_final)
        class_metrics["final_train_resampling"] = final_resampling
        joblib.dump({
            "model": clf,
            "feature_names": feature_names,
            "classes": clf.classes_.tolist(),
        }, CLASSIFIER_PATH)
    else:
        metrics["classification"] = {"skipped": True, "reason": "Only one severity class present in the dataset."}

    X_train_r, X_val_r, X_test_r, y_train_r, y_val_r, y_test_r = split_train_val_test_temporal(X, y_reg, ts_series)

    reg_candidates = {
        # max_depth capped to reduce overfitting on engine_temp + battery_voltage
        # which alone explain ~99 % of variance in an unlimited forest.
        # max_features='sqrt' forces the regressor to use diverse feature subsets
        # so other signals (speed, rpm, fuel) contribute to predictions.
        "shallow": RandomForestRegressor(
            n_estimators=300,
            max_depth=8,
            min_samples_leaf=4,
            max_features="sqrt",
            random_state=42,
            n_jobs=-1,
        ),
        "balanced": RandomForestRegressor(
            n_estimators=400,
            max_depth=6,
            min_samples_leaf=10,
            min_samples_split=20,
            max_features="sqrt",
            random_state=42,
            n_jobs=-1,
        ),
    }

    reg_trials = []
    best_reg_name = ""
    best_val_r2 = float("-inf")
    best_val_mae = float("inf")
    for candidate_name, candidate_model in reg_candidates.items():
        candidate_model.fit(X_train_r, y_train_r)
        val_pred_r = candidate_model.predict(X_val_r)
        val_r2 = float(r2_score(y_val_r, val_pred_r))
        val_mae = float(mean_absolute_error(y_val_r, val_pred_r))
        reg_trials.append(
            {
                "model": candidate_name,
                "validation_r2": val_r2,
                "validation_mae": val_mae,
            }
        )
        if val_r2 > best_val_r2 or (val_r2 == best_val_r2 and val_mae < best_val_mae):
            best_val_r2 = val_r2
            best_val_mae = val_mae
            best_reg_name = candidate_name

    reg = reg_candidates[best_reg_name]
    # Fix 1C: evaluate on test using train-only fit (honest metrics).
    reg.fit(X_train_r, y_train_r)
    y_pred_r = reg.predict(X_test_r)

    reg_metrics = {
        "selected_model": best_reg_name,
        "candidates": reg_trials,
        "split": {
            "train_rows": int(len(X_train_r)),
            "val_rows": int(len(X_val_r)),
            "test_rows": int(len(X_test_r)),
        },
        "mae": float(mean_absolute_error(y_test_r, y_pred_r)),
        "r2": float(r2_score(y_test_r, y_pred_r)),
    }

    temporal_meta_reg = temporal_holdout_indices(df)
    if temporal_meta_reg is not None:
        X_time_train_r = X.loc[temporal_meta_reg["train_idx"]]
        y_time_train_r = y_reg.loc[temporal_meta_reg["train_idx"]]
        X_time_test_r = X.loc[temporal_meta_reg["test_idx"]]
        y_time_test_r = y_reg.loc[temporal_meta_reg["test_idx"]]

        reg_time = clone(reg)
        reg_time.fit(X_time_train_r, y_time_train_r)
        y_time_pred_r = reg_time.predict(X_time_test_r)

        reg_metrics["temporal_holdout"] = {
            "train_rows": int(len(X_time_train_r)),
            "test_rows": int(len(X_time_test_r)),
            "train_end_ts": temporal_meta_reg["train_end_ts"].isoformat() if temporal_meta_reg["train_end_ts"] is not None else None,
            "test_start_ts": temporal_meta_reg["test_start_ts"].isoformat() if temporal_meta_reg["test_start_ts"] is not None else None,
            "mae": float(mean_absolute_error(y_time_test_r, y_time_pred_r)),
            "r2": float(r2_score(y_time_test_r, y_time_pred_r)),
        }

    metrics["regression"] = reg_metrics
    # Production refit on train+val after evaluation.
    reg_prod = clone(reg)
    reg_prod.fit(pd.concat([X_train_r, X_val_r]), pd.concat([y_train_r, y_val_r]))
    joblib.dump({"model": reg_prod, "feature_names": feature_names}, REGRESSOR_PATH)

    metrics["status_after_training"] = get_training_status()

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
        if classification.get("critical_recall") is not None:
            print(f"Classifier critical recall: {classification['critical_recall']:.4f}")
        else:
            print("Classifier critical recall: N/A (critical class absent)")
        temporal_class = classification.get("temporal_holdout")
        if temporal_class:
            print(
                "Temporal holdout (classification): "
                f"acc={temporal_class['accuracy']:.4f}, "
                f"f1_macro={temporal_class['f1_macro']:.4f}, "
                f"critical_recall={temporal_class['critical_recall']:.4f}"
            )
    else:
        print(f"Classifier skipped: {classification['reason']}")

    regression = metrics["regression"]
    print(f"Risk MAE: {regression['mae']:.4f}")
    print(f"Risk R²: {regression['r2']:.4f}")
    temporal_reg = regression.get("temporal_holdout")
    if temporal_reg:
        print(
            "Temporal holdout (regression): "
            f"MAE={temporal_reg['mae']:.4f}, "
            f"R²={temporal_reg['r2']:.4f}"
        )
    print(f"Saved: {CLASSIFIER_PATH}")
    print(f"Saved: {REGRESSOR_PATH}")
    print(f"Saved: {METRICS_PATH}")


if __name__ == "__main__":
    main()
