"""Deprecated legacy simulator.

This script used to publish simulated random telemetry values.
It is intentionally disabled to enforce real data ingestion only
from AutoPi Cloud via backend/scripts/mqtt_gateway.py.
"""


if __name__ == "__main__":
    raise SystemExit(
        "Legacy fake-data simulator is permanently disabled. "
        "Use AutoPi Cloud bridge only: backend/scripts/mqtt_gateway.py"
    )
