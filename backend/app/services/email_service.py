import os
from datetime import datetime

import requests


class EmailService:
    """Brevo API sender for geofence exit notifications."""

    SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@autodiagnostic.com")
    BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
    BREVO_API_URL = os.getenv("BREVO_API_URL", "https://api.brevo.com/v3/smtp/email")
    APP_URL = os.getenv("APP_URL", "http://localhost:5173")

    @staticmethod
    def send_geofence_exit_notification(
        recipient_email: str,
        vehicle_id: int,
        vehicle_license_plate: str,
        geofence_name: str,
        latitude: float,
        longitude: float,
    ) -> bool:
        if not EmailService.BREVO_API_KEY:
            print("[EMAIL] BREVO_API_KEY not configured, skipping email send")
            return False

        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            html = f"""
            <html>
                            <body style=\"margin: 0; padding: 38px 24px; background-color: #f3f4f6; font-family: Arial, sans-serif; color: #111827;\">
                                <div style=\"max-width: 720px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d9dee7; border-radius: 14px; padding: 30px 28px 26px 28px;\">
                                    <h2 style=\"margin: 0 0 14px 0; font-size: 24px; font-weight: 700; color: #e3342f; text-align: center;\">Alerte Geocloture</h2>
                                    <p style=\"margin: 0 0 20px 0; font-size: 18px; text-align: center; color: #111827;\">Le vehicule a quitte la zone configuree.</p>
                                    <div style=\"max-width: 660px; margin: 0 auto 20px auto; background-color: #f9fafb; border: 1px solid #d9dee7; border-radius: 10px; padding: 20px 22px; text-align: left;\">
                                        <p style=\"margin: 0 0 14px 0; font-size: 17px; line-height: 1.5;\"><strong>Vehicule:</strong> {vehicle_license_plate}</p>
                                        <p style=\"margin: 0 0 14px 0; font-size: 17px; line-height: 1.5;\"><strong>Zone:</strong> {geofence_name}</p>
                                        <p style=\"margin: 0 0 14px 0; font-size: 17px; line-height: 1.5;\"><strong>Position:</strong> {latitude:.4f}, {longitude:.4f}</p>
                                        <p style=\"margin: 0; font-size: 17px; line-height: 1.5;\"><strong>Heure:</strong> {timestamp}</p>
                                    </div>

                                    <div style=\"margin-top: 20px; text-align: center;\">
                                        <a href=\"{EmailService.APP_URL}\" style=\"display: inline-block; background-color: #182033; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 13px 20px; border-radius: 8px;\">Revenir a mon application</a>
                                    </div>
                                </div>
              </body>
            </html>
            """
            text = f"""
ALERTE GEOCLOTURE
Vehicule: {vehicle_license_plate}
Zone: {geofence_name}
Position: {latitude:.4f}, {longitude:.4f}
Heure: {timestamp}

Revenir a mon application: {EmailService.APP_URL}
            """.strip()

            payload = {
                "sender": {"email": EmailService.SENDER_EMAIL},
                "to": [{"email": recipient_email}],
                "subject": f"Alerte Geocloture: Vehicule {vehicle_license_plate} a quitte la zone",
                "htmlContent": html,
                "textContent": text,
            }
            headers = {
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": EmailService.BREVO_API_KEY,
            }
            response = requests.post(
                EmailService.BREVO_API_URL,
                json=payload,
                headers=headers,
                timeout=20,
            )
            if response.status_code >= 400:
                print(f"[EMAIL] Brevo API error {response.status_code}: {response.text}")
                return False

            print(f"[EMAIL] Geofence exit notification sent to {recipient_email}")
            return True
        except Exception as exc:
            print(f"[EMAIL] Failed to send notification to {recipient_email}: {exc}")
            return False
