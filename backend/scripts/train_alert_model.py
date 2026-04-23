from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error, r2_score, recall_score
from sklearn.model_selection import StratifiedKFold, train_test_split

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


def split_train_val_test(X, y, *, stratify_enabled: bool):
    stratify_all = y if stratify_enabled and y.value_counts().min() >= 2 else None
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=stratify_all,
    )

    stratify_train = y_train_val if stratify_enabled and y_train_val.value_counts().min() >= 2 else None
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val,
        y_train_val,
        test_size=0.25,
        random_state=42,
        stratify=stratify_train,
    )
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


def apply_smote_for_critical(X_train: pd.DataFrame, y_train: pd.Series, critical_label: str | None):
    if critical_label is None or critical_label not in y_train.astype(str).unique().tolist():
        return X_train, y_train, {"applied": False, "reason": "critical class absent in fold"}

    class_counts = y_train.value_counts()
    critical_count = int(class_counts.get(critical_label, 0))
    if critical_count < 2:
        return X_train, y_train, {"applied": False, "reason": "critical class count < 2 in fold"}

    target_count = int(class_counts.max())
    if critical_count >= target_count:
        return X_train, y_train, {"applied": False, "reason": "critical class already at majority count"}

    smote = SMOTE(
        sampling_strategy={critical_label: target_count},
        k_neighbors=min(5, critical_count - 1),
        random_state=42,
    )
    X_res, y_res = smote.fit_resample(X_train, y_train)
    return X_res, y_res, {
        "applied": True,
        "critical_count_before": critical_count,
        "critical_count_after": int(pd.Series(y_res).value_counts().get(critical_label, 0)),
        "target_count": target_count,
    }


def evaluate_classification_candidates_cv(
    X: pd.DataFrame,
    y: pd.Series,
    candidates: dict[str, RandomForestClassifier],
    critical_label: str | None,
) -> tuple[str, list[dict], dict[str, object]]:
    min_class_count = int(y.value_counts().min())
    n_splits = max(2, min(5, min_class_count))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

    model_summaries: list[dict] = []
    best_name = ""
    best_critical_recall = float("-inf")
    best_f1_macro = float("-inf")

    for candidate_name, candidate_model in candidates.items():
        fold_scores = []
        smote_events = []
        for train_idx, val_idx in cv.split(X, y):
            X_train_fold = X.iloc[train_idx]
            y_train_fold = y.iloc[train_idx]
            X_val_fold = X.iloc[val_idx]
            y_val_fold = y.iloc[val_idx]

            X_train_balanced, y_train_balanced, smote_meta = apply_smote_for_critical(
                X_train_fold,
                y_train_fold,
                critical_label,
            )
            smote_events.append(smote_meta)

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
            "smote": smote_events,
        }
        model_summaries.append(summary)

        ranking_recall = mean_critical_recall if mean_critical_recall is not None else float("-inf")
        if ranking_recall > best_critical_recall or (
            ranking_recall == best_critical_recall and mean_f1_macro > best_f1_macro
        ):
            best_critical_recall = ranking_recall
            best_f1_macro = mean_f1_macro
            best_name = candidate_name

    cv_meta = {
        "strategy": "StratifiedKFold",
        "n_splits": n_splits,
        "selection_priority": ["cv_mean_critical_recall", "cv_mean_f1_macro"],
    }
    return best_name, model_summaries, cv_meta


def resolve_dataset_path() -> Path:
    fixed_dataset = DATA_DIR / "sample_dataset.xlsx"
    if fixed_dataset.exists():
        return fixed_dataset

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
        if col not in labels.columns and col not in {"device_id"}
    ]

    merged = labels.merge(
        engineered[["vehicle_id", "plate", "ts", *feature_only_cols]],
        on=["vehicle_id", "plate", "ts"],
        how="left",
    )

    return merged.sort_values(["vehicle_id", "ts"]).reset_index(drop=True)


def prepare_xy(df: pd.DataFrame):
    feature_cols = [
        "ts",
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

    available = [col for col in feature_cols if col in df.columns]
    X = df[available].copy()

    if "ts" in X.columns:
        ts_numeric = pd.to_datetime(X["ts"], errors="coerce").astype("int64") / 1_000_000_000
        X["ts"] = ts_numeric.where(ts_numeric > 0)

    X = X.apply(pd.to_numeric, errors="coerce")
    X = X.fillna(X.median(numeric_only=True)).fillna(0)

    y_class = df["severity"].astype(str)
    y_reg = pd.to_numeric(df["risk_score"], errors="coerce").fillna(0)
    return X, y_class, y_reg, available


def train_models(df: pd.DataFrame) -> dict:
    X, y_class, y_reg, feature_names = prepare_xy(df)
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
        X_train, X_val, X_test, y_train, y_val, y_test = split_train_val_test(
            X,
            y_class,
            stratify_enabled=True,
        )
        X_train_val = pd.concat([X_train, X_val], ignore_index=True)
        y_train_val = pd.concat([y_train, y_val], ignore_index=True)
        critical_label = resolve_critical_label(y_train_val)

        clf_candidates = {
            "baseline": RandomForestClassifier(
                n_estimators=250,
                max_depth=10,
                min_samples_leaf=2,
                random_state=42,
                class_weight="balanced",
            ),
            "improved": RandomForestClassifier(
                n_estimators=500,
                max_depth=None,
                min_samples_leaf=1,
                min_samples_split=4,
                random_state=42,
                class_weight="balanced_subsample",
            ),
        }

        best_clf_name, clf_trials, cv_meta = evaluate_classification_candidates_cv(
            X_train_val,
            y_train_val,
            clf_candidates,
            critical_label,
        )

        clf = clf_candidates[best_clf_name]
        X_train_final, y_train_final, final_smote = apply_smote_for_critical(
            X_train_val,
            y_train_val,
            critical_label,
        )
        clf.fit(X_train_final, y_train_final)
        y_pred = clf.predict(X_test)
        critical_recall_test = compute_critical_recall(y_test, y_pred, critical_label)

        class_metrics = {
            "selected_model": best_clf_name,
            "candidates": clf_trials,
            "cross_validation": cv_meta,
            "critical_label": critical_label,
            "final_train_smote": final_smote,
            "split": {
                "train_rows": int(len(X_train)),
                "val_rows": int(len(X_val)),
                "test_rows": int(len(X_test)),
            },
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "critical_recall": critical_recall_test,
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

    X_train_r, X_val_r, X_test_r, y_train_r, y_val_r, y_test_r = split_train_val_test(
        X,
        y_reg,
        stratify_enabled=False,
    )

    reg_candidates = {
        "baseline": RandomForestRegressor(
            n_estimators=250,
            max_depth=10,
            min_samples_leaf=2,
            random_state=42,
        ),
        "improved": RandomForestRegressor(
            n_estimators=500,
            max_depth=None,
            min_samples_leaf=1,
            min_samples_split=4,
            random_state=42,
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
    reg.fit(pd.concat([X_train_r, X_val_r]), pd.concat([y_train_r, y_val_r]))
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
    metrics["regression"] = reg_metrics
    joblib.dump({"model": reg, "feature_names": feature_names}, REGRESSOR_PATH)

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
