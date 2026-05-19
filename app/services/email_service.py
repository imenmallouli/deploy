import os
import smtplib
from datetime import datetime
from email.message import EmailMessage

import requests


class EmailService:
    """Email sender for password reset and geofence notifications."""

    SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@autodiagnostic.com")
    BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
    BREVO_API_URL = os.getenv("BREVO_API_URL", "https://api.brevo.com/v3/smtp/email")
    APP_URL = os.getenv("APP_URL", "http://localhost:5173")
    EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "brevo").strip().lower()
    SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _send_via_smtp(recipient_email: str, subject: str, text_content: str, html_content: str | None = None) -> bool:
        if not (EmailService.SMTP_HOST and EmailService.SMTP_USERNAME and EmailService.SMTP_PASSWORD):
            return False

        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = EmailService.SENDER_EMAIL
            msg["To"] = recipient_email
            msg.set_content(text_content)
            if html_content:
                msg.add_alternative(html_content, subtype="html")

            with smtplib.SMTP(EmailService.SMTP_HOST, EmailService.SMTP_PORT, timeout=20) as smtp:
                if EmailService.SMTP_USE_TLS:
                    smtp.starttls()
                smtp.login(EmailService.SMTP_USERNAME, EmailService.SMTP_PASSWORD)
                smtp.send_message(msg)

            print(f"[EMAIL] SMTP email sent to {recipient_email}")
            return True
        except Exception as exc:
            print(f"[EMAIL] SMTP send failed for {recipient_email}: {exc}")
            return False

    @staticmethod
    def _send_via_brevo(recipient_email: str, subject: str, text_content: str, html_content: str) -> bool:
        if not EmailService.BREVO_API_KEY:
            return False

        try:
            payload = {
                "sender": {"email": EmailService.SENDER_EMAIL},
                "to": [{"email": recipient_email}],
                "subject": subject,
                "htmlContent": html_content,
                "textContent": text_content,
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

            print(f"[EMAIL] Brevo email sent to {recipient_email}")
            return True
        except Exception as exc:
            print(f"[EMAIL] Brevo send failed for {recipient_email}: {exc}")
            return False

    @staticmethod
    def send_password_reset_email(recipient_email: str, reset_link: str) -> bool:
        subject = "Reset your password"
        html_content = (
            "<p>You requested a password reset.</p>"
            f"<p><a href=\"{reset_link}\">Reset password</a></p>"
            "<p>If you did not request this, you can ignore this email.</p>"
        )
        text_content = (
            "You requested a password reset.\n"
            f"Open this link: {reset_link}\n"
            "If you did not request this, you can ignore this email."
        )

        provider = EmailService.EMAIL_PROVIDER
        if provider == "smtp":
            return EmailService._send_via_smtp(recipient_email, subject, text_content, html_content) or EmailService._send_via_brevo(recipient_email, subject, text_content, html_content)
        if provider == "auto":
            return EmailService._send_via_smtp(recipient_email, subject, text_content, html_content) or EmailService._send_via_brevo(recipient_email, subject, text_content, html_content)

        # Default: brevo first to match previous behavior.
        return EmailService._send_via_brevo(recipient_email, subject, text_content, html_content) or EmailService._send_via_smtp(recipient_email, subject, text_content, html_content)

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
                        <!DOCTYPE html>
                        <html lang="en">
                            <head>
                                <meta charset="UTF-8" />
                                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                                <title>Geofence Alert</title>
                            </head>
                            <body style="margin: 0; padding: 38px 24px; background-color: #f3f4f6; font-family: Arial, sans-serif; color: #111827;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
                                    <tr>
                                        <td align="center">
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 720px; border-collapse: separate; background-color: #ffffff; border: 1px solid #d9dee7; border-radius: 14px;">
                                                <tr>
                                                    <td style="padding: 30px 28px 26px 28px;">
                                                        <h2 style="margin: 0 0 14px 0; font-size: 24px; font-weight: 700; color: #e3342f; text-align: center;">Geofence Alert</h2>
                                                        <p style="margin: 0 0 20px 0; font-size: 18px; text-align: center; color: #111827;">The vehicle has left the configured zone.</p>
                                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: separate; background-color: #f9fafb; border: 1px solid #d9dee7; border-radius: 10px;">
                                                            <tr>
                                                                <td style="padding: 20px 22px; text-align: left; font-size: 17px; line-height: 1.5; color: #111827;">
                                                                    <p style="margin: 0 0 14px 0;"><strong>Vehicle:</strong> {vehicle_license_plate}</p>
                                                                    <p style="margin: 0 0 14px 0;"><strong>Zone:</strong> {geofence_name}</p>
                                                                    <p style="margin: 0 0 14px 0;"><strong>Position:</strong> {latitude:.4f}, {longitude:.4f}</p>
                                                                    <p style="margin: 0;"><strong>Time:</strong> {timestamp}</p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                        <div style="margin-top: 20px; text-align: center;">
                                                            <a href="{EmailService.APP_URL}" style="display: inline-block; background-color: #182033; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 13px 20px; border-radius: 8px;">Back to my application</a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </body>
                        </html>
                        """
            text = f"""
GEOFENCE ALERT
Vehicle: {vehicle_license_plate}
Zone: {geofence_name}
Position: {latitude:.4f}, {longitude:.4f}
Time: {timestamp}

Back to my application: {EmailService.APP_URL}
            """.strip()

            payload = {
                "sender": {"email": EmailService.SENDER_EMAIL},
                "to": [{"email": recipient_email}],
                "subject": f"Geofence Alert: Vehicle {vehicle_license_plate} left the zone",
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
