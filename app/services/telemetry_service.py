from datetime import datetime, timezone

from app.db.mongodb import get_mongo_db
from app.models.telemetry import TelemetryMongoModel


class TelemetryService:
    INTERVAL_MAP = {
        "1m": "1 minute",
        "5m": "5 minutes",
        "1h": "1 hour",
        "1d": "1 day",
    }

    METRIC_KEYS = {
        "speed": "avg_speed",
        "rpm": "avg_rpm",
        "fuel_level": "avg_fuel_level",
        "engine_temp": "avg_engine_temp",
        "battery_voltage": "avg_battery_voltage",
        "engine_load": "avg_engine_load",
        "ambient_air_temp": "avg_ambient_air_temp",
        "intake_temp": "avg_intake_temp",
        "odometer": "avg_odometer",
    }

    @staticmethod
    async def ping_mongo():
        db = get_mongo_db()
        await db.command("ping")
        return {
            "status": "success",
            "message": "MongoDB Atlas connecté",
            "database": db.name,
        }

    @staticmethod
    async def create_telemetry_point(payload: TelemetryMongoModel, user_id: int):
        db = get_mongo_db()
        doc = payload.to_mongo()
        doc["created_by"] = user_id

        result = await db.telemetry_data.insert_one(doc)
        return {
            "status": "success",
            "message": "Point télémétrie enregistré",
            "id": str(result.inserted_id),
        }

    @staticmethod
    async def get_telemetry_history(
        vehicle_id: int,
        start: datetime | None,
        end: datetime | None,
        interval: str,
        metrics: list[str] | None = None,
    ):
        normalized_interval = (interval or "1h").strip().lower()
        bucket_interval = TelemetryService.INTERVAL_MAP.get(normalized_interval)
        if not bucket_interval:
            return {
                "status": "error",
                "message": "Interval invalide (valeurs autorisées: 1m, 5m, 1h, 1d)",
            }

        selected_metrics = metrics or list(TelemetryService.METRIC_KEYS.keys())
        selected_metrics = [metric.strip() for metric in selected_metrics if metric and metric.strip()]
        invalid_metrics = [metric for metric in selected_metrics if metric not in TelemetryService.METRIC_KEYS]
        if invalid_metrics:
            return {
                "status": "error",
                "message": f"Metrics invalides: {', '.join(invalid_metrics)}",
            }

        start_dt = start or datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        if not start:
            start_dt = start_dt.replace(hour=0)
        end_dt = end or datetime.now(timezone.utc)

        if start_dt >= end_dt:
            return {
                "status": "error",
                "message": "La date de début doit être antérieure à la date de fin",
            }

        interval_seconds = {
            "1 minute": 60,
            "5 minutes": 300,
            "1 hour": 3600,
            "1 day": 86400,
        }[bucket_interval]

        db = get_mongo_db()
        query = {
            "vehicle_id": vehicle_id,
            "ts": {
                "$gte": start_dt,
                "$lte": end_dt,
            },
        }

        cursor = db.telemetry_data.find(query).sort("ts", 1)
        docs = await cursor.to_list(length=None)

        buckets: dict[datetime, dict[str, list[float]]] = {}

        for doc in docs:
            ts = doc.get("ts")
            if ts is None:
                continue
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except ValueError:
                    continue
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)

            ts_epoch = int(ts.timestamp())
            bucket_epoch = ts_epoch - (ts_epoch % interval_seconds)
            bucket_dt = datetime.fromtimestamp(bucket_epoch, tz=timezone.utc)

            if bucket_dt not in buckets:
                buckets[bucket_dt] = {metric: [] for metric in selected_metrics}

            for metric in selected_metrics:
                value = doc.get(metric)
                if value is None:
                    continue
                try:
                    buckets[bucket_dt][metric].append(float(value))
                except (TypeError, ValueError):
                    continue

        data: dict[str, list[dict]] = {metric: [] for metric in selected_metrics}
        for bucket_dt in sorted(buckets.keys()):
            for metric in selected_metrics:
                values = buckets[bucket_dt][metric]
                if not values:
                    continue
                avg_value = sum(values) / len(values)
                data[metric].append(
                    {
                        "timestamp": bucket_dt,
                        "value": float(avg_value),
                    }
                )

        return {
            "status": "success",
            "vehicle_id": vehicle_id,
            "start": start_dt,
            "end": end_dt,
            "interval": normalized_interval,
            "data": data,
        }
