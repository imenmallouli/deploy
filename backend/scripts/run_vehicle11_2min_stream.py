"""
Launcher dedicated to vehicle_id=11.

Behavior:
- Inject telemetry every 120 seconds
- Run DTC + AI diagnostic cycle every 120 seconds
- Keep running until interrupted (Ctrl+C)

Usage:
  python scripts/run_vehicle11_2min_stream.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scripts.simulate_live_vehicle_stream import _find_vehicle, run_live_simulator


async def _main() -> None:
    try:
        vehicle = _find_vehicle(vehicle_id=11, plate=None)
    except RuntimeError as exc:
        raise SystemExit(
            "vehicle_id=11 introuvable dans la base active du backend. "
            "Vérifiez que vous exécutez ce script dans le même environnement que votre API/UI. "
            f"Détail: {exc}"
        ) from exc

    await run_live_simulator(
        vehicle=vehicle,
        mode="critical",
        realtime_interval_sec=120,
        storage_interval_sec=120,
        cycles=None,
    )


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
