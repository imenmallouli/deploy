from __future__ import annotations

import pandas as pd


def _consecutive_true_minutes(series: pd.Series, step_minutes: int = 5) -> pd.Series:
    groups = series.ne(series.shift(fill_value=False)).cumsum()
    counts = series.astype(int).groupby(groups).cumsum()
    return counts * step_minutes


def build_telemetry_features(df: pd.DataFrame) -> pd.DataFrame:
    """Crée des variables utiles pour l'entraînement IA à partir de la télémétrie."""
    if df.empty:
        return df.copy()

    featured = df.copy().sort_values(["vehicle_id", "ts"]).reset_index(drop=True)
    grouped = featured.groupby("vehicle_id", group_keys=False)

    rolling_source_cols = [
        "speed",
        "rpm",
        "engine_temp",
        "battery_voltage",
        "engine_load",
        "fuel_level",
    ]

    for col in rolling_source_cols:
        if col in featured.columns:
            featured[f"{col}_mean_3"] = grouped[col].transform(
                lambda s: s.rolling(window=3, min_periods=1).mean()
            )
            featured[f"{col}_mean_12"] = grouped[col].transform(
                lambda s: s.rolling(window=12, min_periods=1).mean()
            )
            featured[f"{col}_delta"] = grouped[col].diff().fillna(0)

    speed = featured.get("speed", pd.Series(0, index=featured.index))
    rpm = featured.get("rpm", pd.Series(0, index=featured.index))
    engine_temp = featured.get("engine_temp", pd.Series(0, index=featured.index))
    battery_voltage = featured.get("battery_voltage", pd.Series(0, index=featured.index))
    fuel_level = featured.get("fuel_level", pd.Series(0, index=featured.index))
    engine_load = featured.get("engine_load", pd.Series(0, index=featured.index))

    featured["is_idling"] = ((speed < 5) & (rpm > 600)).astype(int)
    featured["is_overheating"] = (engine_temp > 100).astype(int)
    featured["is_battery_low"] = (battery_voltage < 11.8).astype(int)
    featured["is_low_fuel"] = (fuel_level < 15).astype(int)
    featured["is_engine_overload"] = (engine_load > 85).astype(int)
    featured["high_rpm_flag"] = (rpm > 4500).astype(int)

    featured["idle_duration_min"] = grouped["is_idling"].transform(_consecutive_true_minutes)

    return featured.fillna(0)
