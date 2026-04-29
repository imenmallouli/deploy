#!/usr/bin/env python3
"""Simple geofence watcher with email alert on exit.

Notes:
- For real internet email delivery (Gmail/Zoho), SMTP auth is required.
- No-auth mode works only with SMTP servers that allow anonymous relay
  (for example local Mailpit in development).
"""

from __future__ import annotations

import argparse
import json
import os
import smtplib
import time
from dataclasses import dataclass
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import requests


@dataclass
class GeofenceZone:
    name: str
    north: float
    south: float
    east: float
    west: float


@dataclass
class MailConfig:
    smtp_server: str
    smtp_port: int
    smtp_use_tls: bool
    smtp_require_auth: bool
    sender_email: str
    sender_password: str
    recipients: list[str]


def parse_bool(value: str, default: bool) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def parse_recipients(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def load_zone(args: argparse.Namespace) -> GeofenceZone:
    return GeofenceZone(
        name=args.zone_name,
        north=float(args.zone_north),
        south=float(args.zone_south),
        east=float(args.zone_east),
        west=float(args.zone_west),
    )


def load_mail_config(args: argparse.Namespace) -> MailConfig:
    recipients = parse_recipients(args.recipients)
    if not recipients:
        raise ValueError("At least one recipient email is required")

    cfg = MailConfig(
        smtp_server=args.smtp_server,
        smtp_port=int(args.smtp_port),
        smtp_use_tls=parse_bool(args.smtp_use_tls, True),
        smtp_require_auth=parse_bool(args.smtp_require_auth, True),
        sender_email=args.sender_email,
        sender_password=args.sender_password,
        recipients=recipients,
    )

    if cfg.smtp_require_auth and not cfg.sender_password:
        raise ValueError("SMTP auth enabled but sender password is empty")

    return cfg


def get_position_from_tracker(tracker_url: str, timeout_s: int = 10) -> dict[str, float] | None:
    try:
        response = requests.get(tracker_url, timeout=timeout_s)
        response.raise_for_status()
        payload: Any = response.json()

        # Accept common payload formats.
        if isinstance(payload, dict):
            lat = payload.get("latitude", payload.get("lat"))
            lng = payload.get("longitude", payload.get("lng", payload.get("lon")))
        else:
            return None

        if lat is None or lng is None:
            return None

        return {"lat": float(lat), "lng": float(lng)}
    except Exception:
        return None


def get_position_simulated(sim_lat: float, sim_lng: float) -> dict[str, float]:
    return {"lat": float(sim_lat), "lng": float(sim_lng)}


def is_inside_zone(position: dict[str, float], zone: GeofenceZone) -> bool:
    lat = position["lat"]
    lng = position["lng"]
    return zone.south <= lat <= zone.north and zone.west <= lng <= zone.east


def build_email_html(zone: GeofenceZone, position: dict[str, float], when_str: str) -> str:
    lat = position["lat"]
    lng = position["lng"]
    maps_url = f"https://maps.google.com/?q={lat},{lng}"

    return f"""
<html>
  <body style=\"font-family: Arial, sans-serif; max-width: 640px; margin: auto;\">
    <h2 style=\"color: #a93226;\">Geofence Alert</h2>
    <p>Vehicle exited the allowed zone.</p>
    <table style=\"border-collapse: collapse; width: 100%;\">
      <tr><td><strong>Time</strong></td><td>{when_str}</td></tr>
      <tr><td><strong>Zone</strong></td><td>{zone.name}</td></tr>
      <tr><td><strong>Latitude</strong></td><td>{lat:.6f}</td></tr>
      <tr><td><strong>Longitude</strong></td><td>{lng:.6f}</td></tr>
    </table>
    <p><a href=\"{maps_url}\">Open in Google Maps</a></p>
  </body>
</html>
""".strip()


def send_email_alert(mail_cfg: MailConfig, zone: GeofenceZone, position: dict[str, float], when_str: str) -> bool:
    subject = f"Geofence Alert: Vehicle left zone ({zone.name})"
    html = build_email_html(zone, position, when_str)

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = mail_cfg.sender_email
    message["To"] = ", ".join(mail_cfg.recipients)
    message.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(mail_cfg.smtp_server, mail_cfg.smtp_port, timeout=20) as server:
            if mail_cfg.smtp_use_tls:
                server.starttls()
            if mail_cfg.smtp_require_auth:
                server.login(mail_cfg.sender_email, mail_cfg.sender_password)
            server.sendmail(mail_cfg.sender_email, mail_cfg.recipients, message.as_string())
        return True
    except Exception as exc:
        print(f"[EMAIL] Send failed: {exc}")
        return False


def parser_from_env() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Geofence watcher with email alert on zone exit")

    # Zone config
    parser.add_argument("--zone-name", default=os.getenv("GF_ZONE_NAME", "Authorized zone"))
    parser.add_argument("--zone-north", default=os.getenv("GF_ZONE_NORTH", "36.8250"))
    parser.add_argument("--zone-south", default=os.getenv("GF_ZONE_SOUTH", "36.8130"))
    parser.add_argument("--zone-east", default=os.getenv("GF_ZONE_EAST", "10.1750"))
    parser.add_argument("--zone-west", default=os.getenv("GF_ZONE_WEST", "10.1570"))

    # Position source
    parser.add_argument("--mode", choices=["simulation", "tracker"], default=os.getenv("GF_MODE", "simulation"))
    parser.add_argument("--tracker-url", default=os.getenv("GF_TRACKER_URL", ""))
    parser.add_argument("--sim-lat", default=os.getenv("GF_SIM_LAT", "36.8400"))
    parser.add_argument("--sim-lng", default=os.getenv("GF_SIM_LNG", "10.1900"))

    # Loop interval
    parser.add_argument("--interval", type=int, default=int(os.getenv("GF_INTERVAL_SECONDS", "30")))

    # Mail config
    parser.add_argument("--smtp-server", default=os.getenv("SMTP_SERVER", "smtp.gmail.com"))
    parser.add_argument("--smtp-port", default=os.getenv("SMTP_PORT", "587"))
    parser.add_argument("--smtp-use-tls", default=os.getenv("SMTP_USE_TLS", "true"))
    parser.add_argument("--smtp-require-auth", default=os.getenv("SMTP_REQUIRE_AUTH", "true"))
    parser.add_argument("--sender-email", default=os.getenv("SENDER_EMAIL", ""))
    parser.add_argument("--sender-password", default=os.getenv("SENDER_PASSWORD", ""))
    parser.add_argument("--recipients", default=os.getenv("GF_RECIPIENTS", ""))

    return parser


def main() -> None:
    args = parser_from_env().parse_args()
    zone = load_zone(args)
    mail_cfg = load_mail_config(args)

    print("=" * 58)
    print("GEOFENCE WATCHER STARTED")
    print("=" * 58)
    print(f"Zone      : {zone.name}")
    print(f"Bounds    : N={zone.north} S={zone.south} E={zone.east} W={zone.west}")
    print(f"Mode      : {args.mode}")
    print(f"Recipients: {', '.join(mail_cfg.recipients)}")
    print(f"Interval  : {args.interval}s")

    was_inside = True
    alert_sent_for_current_exit = False

    while True:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if args.mode == "simulation":
            position = get_position_simulated(float(args.sim_lat), float(args.sim_lng))
        else:
            if not args.tracker_url:
                print("[GPS] Tracker mode selected but --tracker-url is empty")
                time.sleep(args.interval)
                continue
            position = get_position_from_tracker(args.tracker_url)
            if position is None:
                print(f"[{now}] [GPS] Could not read tracker position")
                time.sleep(args.interval)
                continue

        inside = is_inside_zone(position, zone)
        lat = position["lat"]
        lng = position["lng"]

        if inside:
            print(f"[{now}] IN ZONE ({lat:.6f}, {lng:.6f})")
            alert_sent_for_current_exit = False
        else:
            print(f"[{now}] OUT OF ZONE ({lat:.6f}, {lng:.6f})")
            # Send once per transition from inside -> outside.
            if was_inside and not alert_sent_for_current_exit:
                print(f"[{now}] Sending email alert...")
                ok = send_email_alert(mail_cfg, zone, position, now)
                print(f"[{now}] Email status: {'OK' if ok else 'FAILED'}")
                alert_sent_for_current_exit = ok

        was_inside = inside
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
