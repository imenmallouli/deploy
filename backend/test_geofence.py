#!/usr/bin/env python
import argparse
import json
import subprocess
import time

import requests

BASE_URL = "http://127.0.0.1:8000"
LOGIN_EMAIL = "imen.mallouli@malloulinova.com"
NOTIFICATION_EMAIL = "imenmallouli63@gmail.com"
PASSWORD = "hellohello"
VEHICLE_ID = 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay geofence exit and trigger Gmail notification")
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--login-email", default=LOGIN_EMAIL)
    parser.add_argument("--notification-email", default=NOTIFICATION_EMAIL)
    parser.add_argument("--password", default=PASSWORD)
    parser.add_argument("--vehicle-id", type=int, default=VEHICLE_ID)
    args = parser.parse_args()

    print("====== TEST GEOFENCE EXIT EMAIL ======\n")

    print("1) Authentification")
    response = requests.post(
        f"{args.base_url}/api/v1/auth/login",
        json={"email": args.login_email, "password": args.password},
        timeout=20,
    )
    response.raise_for_status()
    token = response.json().get("access_token")
    if not token:
        print("Erreur: token vide")
        return 1
    print("Token recu")

    headers = {"Authorization": f"Bearer {token}"}

    print("2) Charger geofences")
    response = requests.get(f"{args.base_url}/api/v1/geofences", headers=headers, timeout=20)
    response.raise_for_status()
    geofences = response.json().get("items", [])
    if not geofences:
        print("Erreur: aucune geocloture disponible")
        return 1

    target = None
    for g in geofences:
        poly = g.get("polygon") or []
        if len(poly) >= 3:
            target = g
            break
    if not target:
        print("Erreur: aucune geocloture polygon valide")
        return 1

    geofence_id = target["id"]
    geofence_name = target.get("name", "(sans nom)")
    polygon = target.get("polygon")
    print(f"Zone cible: {geofence_name} ({geofence_id})")

    center_lat = sum(p[0] for p in polygon) / len(polygon)
    center_lng = sum(p[1] for p in polygon) / len(polygon)
    max_lat = max(p[0] for p in polygon)
    max_lng = max(p[1] for p in polygon)
    outside_lat = max_lat + 0.01
    outside_lng = max_lng + 0.01

    print("3) Configurer monitoring vers Gmail")
    response = requests.post(
        f"{args.base_url}/api/v1/geofences/monitoring/setup",
        headers=headers,
        json={
            "geofence_id": geofence_id,
            "vehicle_ids": [args.vehicle_id],
            "notification_email": args.notification_email,
        },
        timeout=20,
    )
    response.raise_for_status()
    print("Monitoring configure")

    print("4) Envoyer position INSIDE")
    response = requests.post(
        f"{args.base_url}/api/v1/geofences/vehicle-positions",
        headers=headers,
        json={"vehicle_id": args.vehicle_id, "latitude": center_lat, "longitude": center_lng},
        timeout=20,
    )
    response.raise_for_status()
    print(json.dumps(response.json(), indent=2))

    time.sleep(2)

    print("5) Envoyer position OUTSIDE (declenche sortie)")
    response = requests.post(
        f"{args.base_url}/api/v1/geofences/vehicle-positions",
        headers=headers,
        json={"vehicle_id": args.vehicle_id, "latitude": outside_lat, "longitude": outside_lng},
        timeout=20,
    )
    response.raise_for_status()
    print(json.dumps(response.json(), indent=2))

    print("\n6) Verification logs backend")
    try:
        result = subprocess.run(
            ["docker", "compose", "logs", "backend", "--tail", "120"],
            capture_output=True,
            text=True,
            cwd=".",
            check=False,
        )
        logs = result.stdout
        relevant_logs = [
            line
            for line in logs.split("\n")
            if "email" in line.lower() or "geofence" in line.lower() or "exit" in line.lower()
        ]
        if relevant_logs:
            for line in relevant_logs:
                print(line)
        else:
            print("Aucun log email trouve")
    except Exception as exc:
        print(f"Erreur logs: {exc}")

    print("\nDone")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
