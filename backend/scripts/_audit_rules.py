from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(r"c:/auto diagnostic platform/backend")
XLSX_PATH = ROOT / "data" / "sample_dataset.xlsx"

EXPECTED_BY_SET = {
    "sensor_rules": [
        "battery_critical_low",
        "battery_warning_low",
        "temp_critical",
        "temp_warning",
        "fuel_critical",
        "fuel_warning",
        "speed_critical",
        "speed_warning",
        "rpm_warning",
        "load_warning",
        "cpu_temp_critical",
        "cpu_temp_warning",
        "cpu_load_warning",
        "gpu_load_warning",
        "intake_critical",
        "intake_warning",
        "ambient_warning",
        "battery_warning_alt_suspect",
        "battery_critical_overvoltage",
        "battery_warning_overvoltage",
        "thermal_delta_warning",
    ],
    "maintenance_rules": [
        "oil_critical",
        "oil_warning",
        "oil_info",
        "service_warning",
        "service_info",
        "parts_warning",
        "parts_info",
    ],
    "fallback_rules": [
        "mileage_warning",
        "mileage_info",
    ],
}


def main() -> None:
    expected = []
    expected_by_set = {"sensor_rules": [], "maintenance_rules": [], "fallback_rules": []}
    for rs in ("sensor_rules", "maintenance_rules", "fallback_rules"):
        expected.extend(EXPECTED_BY_SET[rs])
        expected_by_set[rs].extend(EXPECTED_BY_SET[rs])

    df = pd.read_excel(XLSX_PATH, sheet_name="recommendation_rules_simple")
    dataset_ids = [str(v) for v in df["rule_id"].dropna().tolist()]
    dataset_set = set(dataset_ids)
    expected_set = set(expected)

    print("=== COUNTS ===")
    print("json_expected_total:", len(expected_set))
    print("dataset_total_rows:", len(dataset_ids))
    print("dataset_unique_ids:", len(dataset_set))

    print("\n=== DATASET RULESET BREAKDOWN ===")
    if "ruleset" in df.columns:
        for rs in ("sensor_rules", "maintenance_rules", "fallback_rules"):
            count = int((df["ruleset"] == rs).sum())
            print(f"{rs}: {count}")

    missing = sorted(expected_set - dataset_set)
    extra = sorted(dataset_set - expected_set)

    print("\n=== DIFF VS JSON ===")
    print("missing:", missing)
    print("extra:", extra)

    print("\n=== MAINTENANCE RULES CHECK ===")
    for rid in expected_by_set["maintenance_rules"]:
        present = rid in dataset_set
        print(f"{rid}: {'OK' if present else 'MISSING'}")

    print("\n=== MAINTENANCE MESSAGES IN DATASET ===")
    if "ruleset" in df.columns and "message" in df.columns:
        mdf = df[df["ruleset"] == "maintenance_rules"]["rule_id"].to_frame()
        mdf["message"] = df[df["ruleset"] == "maintenance_rules"]["message"].values
        for _, row in mdf.iterrows():
            print(f"{row['rule_id']} | {row['message']}")


if __name__ == "__main__":
    main()
