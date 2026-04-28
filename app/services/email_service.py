import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


class EmailService:
    """SMTP email sender for geofence exit notifications."""

    SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@autodiagnostic.com")
    SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")

    @staticmethod
    def send_geofence_exit_notification(
        recipient_email: str,
        vehicle_id: int,
        vehicle_license_plate: str,
        geofence_name: str,
        latitude: float,
        longitude: float,
    ) -> bool:
        if not EmailService.SENDER_PASSWORD:
            print("[EMAIL] SENDER_PASSWORD not configured, skipping email send")
            return False

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = f"Alerte Geocloture: Vehicule {vehicle_license_plate} a quitte la zone"
            message["From"] = EmailService.SENDER_EMAIL
            message["To"] = recipient_email

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            html = f"""
            <html>
              <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">
                <div style=\"max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;\">
                  <h2 style=\"color: #d9534f;\">Alerte Geocloture</h2>
                  <p>Le vehicule a quitte la zone configuree.</p>
                  <div style=\"background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;\">
                    <p><strong>Vehicule:</strong> {vehicle_license_plate} (ID: {vehicle_id})</p>
                    <p><strong>Zone:</strong> {geofence_name}</p>
                    <p><strong>Position:</strong> {latitude:.4f}, {longitude:.4f}</p>
                    <p><strong>Heure:</strong> {timestamp}</p>
                  </div>
                </div>
              </body>
            </html>
            """
            text = f"""
ALERTE GEOCLOTURE
Vehicule: {vehicle_license_plate} (ID: {vehicle_id})
Zone: {geofence_name}
Position: {latitude:.4f}, {longitude:.4f}
Heure: {timestamp}
            """.strip()

            message.attach(MIMEText(text, "plain"))
            message.attach(MIMEText(html, "html"))

            with smtplib.SMTP(EmailService.SMTP_SERVER, EmailService.SMTP_PORT) as server:
                server.starttls()
                server.login(EmailService.SENDER_EMAIL, EmailService.SENDER_PASSWORD)
                server.send_message(message)

            print(f"[EMAIL] Geofence exit notification sent to {recipient_email}")
            return True
        except Exception as exc:
            print(f"[EMAIL] Failed to send notification to {recipient_email}: {exc}")
            return False
