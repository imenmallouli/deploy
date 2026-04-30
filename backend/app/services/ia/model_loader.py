from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib

BASE_DIR = Path(__file__).resolve().parents[3]
MODELS_DIR = BASE_DIR / "data" / "models"
CLASSIFIER_PATH = MODELS_DIR / "severity_classifier.joblib"
REGRESSOR_PATH = MODELS_DIR / "risk_regressor.joblib"
BENCHMARK_PATH = MODELS_DIR / "algorithm_benchmark.json"


def _load_bundle(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            "AI model not found. Run backend/scripts/train_alert_model.py to generate model files."
        )
    return joblib.load(path)


@lru_cache(maxsize=1)
def load_classifier_bundle() -> dict[str, Any]:
    return _load_bundle(CLASSIFIER_PATH)


@lru_cache(maxsize=1)
def load_regressor_bundle() -> dict[str, Any]:
    return _load_bundle(REGRESSOR_PATH)


@lru_cache(maxsize=1)
def get_model_metadata() -> dict[str, Any]:
    classifier_bundle = load_classifier_bundle()
    regressor_bundle = load_regressor_bundle()

    payload: dict[str, Any] = {
        "classifier_path": str(CLASSIFIER_PATH),
        "regressor_path": str(REGRESSOR_PATH),
        "classifier_name": type(classifier_bundle["model"]).__name__,
        "regressor_name": type(regressor_bundle["model"]).__name__,
        "feature_names": classifier_bundle.get("feature_names", []),
    }

    if BENCHMARK_PATH.exists():
        with BENCHMARK_PATH.open("r", encoding="utf-8") as fh:
            payload["benchmark"] = json.load(fh)

    return payload
