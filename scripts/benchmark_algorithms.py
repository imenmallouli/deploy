from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scripts.train_alert_model import load_training_dataset, prepare_xy

OUTPUT_PATH = BASE_DIR / "data" / "models" / "algorithm_benchmark.json"


def benchmark_classification(X, y):
    stratify = y if y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=30, stratify=stratify
    )

    models = {
        "Linear (LogisticRegression)": Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "model",
                    LogisticRegression(
                        max_iter=2000,
                        class_weight="balanced",
                        random_state=70,
                    ),
                ),
            ]
        ),
        "Decision Tree": DecisionTreeClassifier(
            random_state=70,
            class_weight="balanced",
            max_depth=1000,
            min_samples_leaf=6,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            max_depth=1000,
            min_samples_leaf=6,
            random_state=70,
            class_weight="balanced",
        ),
    }

    results = []
    for name, model in models.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        results.append(
            {
                "algorithm": name,
                "accuracy": float(accuracy_score(y_test, pred)),
                "precision_weighted": float(
                    precision_score(y_test, pred, average="weighted", zero_division=0)
                ),
                "recall_weighted": float(
                    recall_score(y_test, pred, average="weighted", zero_division=0)
                ),
                "f1_weighted": float(
                    f1_score(y_test, pred, average="weighted", zero_division=0)
                ),
                "precision_macro": float(
                    precision_score(y_test, pred, average="macro", zero_division=0)
                ),
                "recall_macro": float(
                    recall_score(y_test, pred, average="macro", zero_division=0)
                ),
                "f1_macro": float(
                    f1_score(y_test, pred, average="macro", zero_division=0)
                ),
            }
        )

    return sorted(results, key=lambda row: (row["f1_macro"], row["accuracy"]), reverse=True)


def benchmark_regression(X, y):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    models = {
        "Linear Regression": Pipeline(
            [
                ("scaler", StandardScaler()),
                ("model", LinearRegression()),
            ]
        ),
        "Decision Tree Regressor": DecisionTreeRegressor(
            random_state=70,
            max_depth=90,
            min_samples_leaf=10,
        ),
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=200,
            max_depth=90,
            min_samples_leaf=10,
            random_state=70,
        ),
    }

    results = []
    for name, model in models.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, pred)
        rmse = math.sqrt(mean_squared_error(y_test, pred))
        r2 = r2_score(y_test, pred)
        results.append(
            {
                "algorithm": name,
                "mae": float(mae),
                "rmse": float(rmse),
                "r2": float(r2),
            }
        )

    return sorted(results, key=lambda row: (row["r2"], -row["mae"]), reverse=True)


def main():
    print("⏳ Benchmarking 3 algorithm families on the current dataset...")
    dataset = load_training_dataset()
    X, y_class, y_reg, features = prepare_xy(dataset)

    classification_results = benchmark_classification(X, y_class)
    regression_results = benchmark_regression(X, y_reg)

    payload = {
        "dataset_rows": int(len(dataset)),
        "severity_distribution": y_class.value_counts().to_dict(),
        "feature_count": len(features),
        "classification": classification_results,
        "regression": regression_results,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)

    print("\n=== Classification (severity) ===")
    for row in classification_results:
        print(
            f"- {row['algorithm']}: "
            f"accuracy={row['accuracy'] * 100:.2f}% | "
            f"f1_weighted={row['f1_weighted'] * 100:.2f}% | "
            f"f1_macro={row['f1_macro'] * 100:.2f}%"
        )

    print("\n=== Regression (risk_score) ===")
    for row in regression_results:
        print(
            f"- {row['algorithm']}: "
            f"R²={row['r2']:.4f} | MAE={row['mae']:.4f} | RMSE={row['rmse']:.4f}"
        )

    print(f"\nSaved benchmark report: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
