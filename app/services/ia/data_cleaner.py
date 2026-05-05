from __future__ import annotations

import numpy as np
import pandas as pd

NUMERIC_RANGES: dict[str, tuple[float, float]] = {
    "speed": (0, 220),
    "rpm": (0, 8000),
    "fuel_level": (0, 100),
    "engine_temp": (-40, 130),
    "battery_voltage": (9, 16),
    "engine_load": (0, 100),
    "ambient_air_temp": (-20, 60),
    "intake_temp": (-20, 80),
    "odometer": (0, 2_000_000),
    "temp_cpu": (20, 120),
    "cpu": (0, 100),
    "gpu": (0, 100),
    "risk_score": (0, 100),
}

VALID_SEVERITIES = {"info", "warning", "critical"}


def clean_telemetry_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Nettoie les données télémétriques pour le preprocessing IA."""
    if df.empty:
        return df.copy()

    cleaned = df.copy()

    required = {"vehicle_id", "ts"}
    missing = required.difference(cleaned.columns)
    if missing:
        raise ValueError(f"Missing required telemetry columns: {sorted(missing)}")

    cleaned["ts"] = pd.to_datetime(cleaned["ts"], errors="coerce")
    cleaned = cleaned.dropna(subset=["vehicle_id", "ts"])
    cleaned = cleaned.sort_values(["vehicle_id", "ts"]).drop_duplicates(
        subset=["vehicle_id", "ts"], keep="last"
    )

    numeric_cols = [col for col in NUMERIC_RANGES if col in cleaned.columns]
    for col in numeric_cols:
        cleaned[col] = pd.to_numeric(cleaned[col], errors="coerce")
        low, high = NUMERIC_RANGES[col]
        cleaned.loc[(cleaned[col] < low) | (cleaned[col] > high), col] = np.nan
        cleaned[col] = cleaned.groupby("vehicle_id")[col].transform(
            lambda s: s.interpolate(method="linear", limit_direction="both")
        )
        median_value = cleaned[col].median()
        cleaned[col] = cleaned[col].fillna(0 if pd.isna(median_value) else median_value)

    return cleaned.reset_index(drop=True)


def clean_label_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Valide et nettoie les labels utilisés pour l'entraînement."""
    if df.empty:
        return df.copy()

    cleaned = df.copy()

    if "ts" in cleaned.columns:
        cleaned["ts"] = pd.to_datetime(cleaned["ts"], errors="coerce")

    if "risk_score" in cleaned.columns:
        cleaned["risk_score"] = pd.to_numeric(cleaned["risk_score"], errors="coerce")
        cleaned.loc[(cleaned["risk_score"] < 0) | (cleaned["risk_score"] > 100), "risk_score"] = np.nan

    if "severity" in cleaned.columns:
        cleaned["severity"] = cleaned["severity"].astype(str).str.lower().str.strip()
        cleaned = cleaned[cleaned["severity"].isin(VALID_SEVERITIES)]

    cleaned = cleaned.dropna(subset=[col for col in ["vehicle_id", "ts", "severity", "risk_score"] if col in cleaned.columns])
    return cleaned.reset_index(drop=True)
