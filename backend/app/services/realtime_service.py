from datetime import datetime, timezone

from app.db.mongodb import get_mongo_db
from app.models.realtime import (
    RealtimePredictiveSignalModel,
    RealtimeTelemetryEventModel,
    RealtimeTelemetryMetricsModel,
)
from app.services.user_service import UserService


class RealtimeService:
    @staticmethod
    def validate_ws_token(token: str | None) -> bool:
        if not token:
            return True
        UserService.decode_access_token(token)
        return True

    @staticmethod
    async def get_latest_event(vehicle_id: int, last_seen_id: str | None):
        db = get_mongo_db()
        doc = await db.telemetry_data.find_one(
            {"vehicle_id": vehicle_id},
            sort=[("ts", -1)],
        )

        if doc is None:
            return None, last_seen_id

        doc_id = str(doc.get("_id"))
        if doc_id == last_seen_id:
            return None, last_seen_id

        event = RealtimeService._to_realtime_event(vehicle_id=vehicle_id, doc=doc)
        return event, doc_id

    @staticmethod
    def _to_float(value):
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_realtime_event(vehicle_id: int, doc: dict) -> RealtimeTelemetryEventModel:
        ts = doc.get("ts")
        if isinstance(ts, datetime) and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        metrics = RealtimeTelemetryMetricsModel(
            speed=RealtimeService._to_float(doc.get("speed")),
            rpm=RealtimeService._to_float(doc.get("rpm")),
            fuel_level=RealtimeService._to_float(doc.get("fuel_level")),
            engine_temp=RealtimeService._to_float(doc.get("engine_temp")),
            battery_voltage=RealtimeService._to_float(doc.get("battery_voltage")),
            engine_load=RealtimeService._to_float(doc.get("engine_load")),
            ambient_air_temp=RealtimeService._to_float(doc.get("ambient_air_temp")),
            intake_temp=RealtimeService._to_float(doc.get("intake_temp")),
            odometer=RealtimeService._to_float(doc.get("odometer")),
        )

        return RealtimeTelemetryEventModel(
            vehicle_id=vehicle_id,
            timestamp=ts.isoformat() if isinstance(ts, datetime) else datetime.now(timezone.utc).isoformat(),
            metrics=metrics,
            predictive_signals=RealtimeService._predictive_signals(metrics),
        )

    @staticmethod
    def _predictive_signals(metrics: RealtimeTelemetryMetricsModel) -> list[RealtimePredictiveSignalModel]:
        signals: list[RealtimePredictiveSignalModel] = []

        if metrics.engine_temp is not None and metrics.engine_temp >= 110:
            signals.append(
                RealtimePredictiveSignalModel(
                    type="overheat_risk",
                    severity="critical",
                    message="Température moteur critique (>= 110°C)",
                    recommendation="Arrêt immédiat et contrôle du circuit de refroidissement.",
                )
            )
        elif metrics.engine_temp is not None and metrics.engine_temp >= 100:
            signals.append(
                RealtimePredictiveSignalModel(
                    type="overheat_warning",
                    severity="warning",
                    message="Température moteur élevée (>= 100°C)",
                    recommendation="Planifier une inspection du système de refroidissement.",
                )
            )

        if metrics.battery_voltage is not None and metrics.battery_voltage < 11.5:
            signals.append(
                RealtimePredictiveSignalModel(
                    type="battery_critical",
                    severity="critical",
                    message="Batterie faible (< 11.5V)",
                    recommendation="Vérifier alternateur, batterie et circuit de charge.",
                )
            )
        elif metrics.battery_voltage is not None and metrics.battery_voltage < 12.0:
            signals.append(
                RealtimePredictiveSignalModel(
                    type="battery_warning",
                    severity="warning",
                    message="Batterie en baisse (< 12.0V)",
                    recommendation="Prévoir un contrôle batterie.",
                )
            )

        if metrics.fuel_level is not None and metrics.fuel_level < 10:
            signals.append(
                RealtimePredictiveSignalModel(
                    type="fuel_critical",
                    severity="critical",
                    message="Niveau carburant critique (< 10%)",
                    recommendation="Ravitaillement immédiat conseillé.",
                )
            )
        elif metrics.fuel_level is not None and metrics.fuel_level < 15:
            signals.append(
                RealtimePredictiveSignalModel(
                    type="fuel_warning",
                    severity="warning",
                    message="Niveau carburant bas (< 15%)",
                    recommendation="Planifier ravitaillement prochainement.",
                )
            )

        if metrics.rpm is not None and metrics.rpm > 4500:
            signals.append(
                RealtimePredictiveSignalModel(
                    type="high_rpm_warning",
                    severity="warning",
                    message="Régime moteur élevé (> 4500 RPM)",
                    recommendation="Analyser style de conduite et charge moteur.",
                )
            )

        return signals
