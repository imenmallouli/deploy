from datetime import datetime

from bson import ObjectId

from app.db.mongodb import get_mongo_db
from app.db.session import SessionLocal
from app.models.dtc import DtcEventModel, IotDeviceLogModel, ObdRawPayloadModel
from app.models.vehicle import Vehicle
from app.services.ingestion_guard import assert_vehicle_dongle_linked
from app.services.ops_service import OpsService


class DtcService:
    @staticmethod
    def _allowed_vehicle_ids(role: str, user_id: int) -> list[int] | None:
        normalized = (role or "user").strip().lower()
        if normalized == "admin":
            return None

        sql_db = SessionLocal()
        try:
            return [row[0] for row in sql_db.query(Vehicle.id).filter(Vehicle.driver_id == user_id).all()]
        finally:
            sql_db.close()

    @staticmethod
    def _extract_gps_from_iot_log(payload: IotDeviceLogModel) -> tuple[float, float] | None:
        if (payload.event_type or "").lower() != "gps":
            return None

        metadata = payload.metadata or {}
        loc = metadata.get("loc") if isinstance(metadata.get("loc"), dict) else {}
        lat = loc.get("lat", metadata.get("lat"))
        lng = loc.get("lon", metadata.get("lon", metadata.get("lng")))

        if lat is None or lng is None:
            return None

        try:
            return float(lat), float(lng)
        except (TypeError, ValueError):
            return None

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
    async def create_dtc_event(payload: DtcEventModel, user_id: int):
        db = get_mongo_db()

        doc = payload.to_mongo()
        doc["created_by"] = user_id

        sql_db = SessionLocal()
        try:
            matched_alias = assert_vehicle_dongle_linked(
                sql_db,
                vehicle_id=int(doc.get("vehicle_id")),
                candidates=[
                    doc.get("device_id"),
                    doc.get("dongle_id"),
                    doc.get("autopi_device_id"),
                    doc.get("autopi_unit_id"),
                ],
            )
            doc["device_id"] = doc.get("device_id") or matched_alias
        finally:
            sql_db.close()

        result = await db.dtc_events.insert_one(doc)
        return {
            "status": "success",
            "message": "DTC event créé",
            "id": str(result.inserted_id),
        }

    @staticmethod
    async def list_dtc_events(limit: int = 50, role: str = "user", user_id: int | None = None):
        db = get_mongo_db()

        query: dict = {}
        if user_id is not None:
            allowed_vehicle_ids = DtcService._allowed_vehicle_ids(role=role, user_id=user_id)
            if allowed_vehicle_ids is not None:
                if not allowed_vehicle_ids:
                    return {"status": "success", "count": 0, "items": []}
                query["vehicle_id"] = {"$in": allowed_vehicle_ids}

        cursor = db.dtc_events.find(query).sort("_id", -1).limit(limit)
        items = []
        async for doc in cursor:
            items.append(DtcEventModel.from_mongo(doc).model_dump(exclude_none=True))

        return {
            "status": "success",
            "count": len(items),
            "items": items,
        }

    @staticmethod
    async def list_dtc_by_vehicle(vehicle_id: int, limit: int = 50, role: str = "user", user_id: int | None = None):
        db = get_mongo_db()

        if user_id is not None:
            allowed_vehicle_ids = DtcService._allowed_vehicle_ids(role=role, user_id=user_id)
            if allowed_vehicle_ids is not None and vehicle_id not in allowed_vehicle_ids:
                return {"status": "error", "message": "Accès refusé"}

        cursor = db.dtc_events.find({"vehicle_id": vehicle_id}).sort("_id", -1).limit(limit)
        items = []
        async for doc in cursor:
            items.append(DtcEventModel.from_mongo(doc).model_dump(exclude_none=True))

        return {
            "status": "success",
            "vehicle_id": vehicle_id,
            "count": len(items),
            "items": items,
        }

    @staticmethod
    async def get_dtc_history(dtc_id: str):
        db = get_mongo_db()

        filters = [{"code": dtc_id}, {"dtc_code": dtc_id}]
        if ObjectId.is_valid(dtc_id):
            filters.append({"_id": ObjectId(dtc_id)})

        cursor = db.dtc_events.find({"$or": filters}).sort("_id", 1)

        docs = []
        async for doc in cursor:
            docs.append(DtcEventModel.from_mongo(doc))

        if not docs:
            return {"status": "error", "message": "Historique DTC introuvable"}

        history = []
        clear_events = []
        occurrences = []
        for doc in docs:
            start_date = doc.first_detected or doc.created_at
            end_date = doc.end_date or doc.resolved_at
            duration_minutes = DtcService._duration_minutes(start_date, end_date)

            history.append(
                {
                    "start_date": start_date,
                    "end_date": end_date,
                    "duration_minutes": duration_minutes,
                    "mileage_at_detection": doc.mileage_at_detection,
                    "resolved": bool(doc.resolved),
                }
            )

            occurrences.append(
                {
                    "id": doc.id,
                    "first_detected": doc.first_detected,
                    "last_occurrence": doc.last_occurrence,
                    "created_at": doc.created_at,
                    "resolved": bool(doc.resolved),
                    "resolved_at": doc.resolved_at,
                    "cleared_at": doc.cleared_at,
                }
            )

            if doc.cleared_at:
                clear_events.append(
                    {
                        "dtc_event_id": doc.id,
                        "vehicle_id": doc.vehicle_id,
                        "dtc_code": doc.code,
                        "cleared_at": doc.cleared_at,
                        "cleared_by": doc.cleared_by,
                    }
                )

        first = docs[0]
        return {
            "status": "success",
            "dtc_code": first.code,
            "vehicle_id": first.vehicle_id,
            "total_occurrences": len(docs),
            "history": history,
            "occurrences": occurrences,
            "clear_events": clear_events,
        }

    @staticmethod
    async def clear_dtc(role: str, user_id: int, vehicle_id: int, dtc_code: str | None = None):
        role = (role or "user").strip().lower()
        if role not in {"admin", "manager", "user"}:
            return {"status": "error", "message": "Accès refusé"}

        if role == "user":
            sql_db = SessionLocal()
            try:
                own_vehicle = sql_db.query(Vehicle.id).filter(Vehicle.id == vehicle_id, Vehicle.driver_id == user_id).first()
                if not own_vehicle:
                    return {"status": "error", "message": "Accès refusé"}
            finally:
                sql_db.close()

        db = get_mongo_db()
        query = {"vehicle_id": vehicle_id}
        if dtc_code:
            query["$or"] = [{"code": dtc_code}, {"dtc_code": dtc_code}]

        result = await db.dtc_events.update_many(
            query,
            {
                "$set": {
                    "resolved": True,
                    "cleared_at": datetime.utcnow().isoformat() + "Z",
                    "cleared_by": user_id,
                }
            },
        )

        return {
            "status": "success",
            "message": "DTC clear exécuté",
            "vehicle_id": vehicle_id,
            "dtc_code": dtc_code,
            "matched_count": result.matched_count,
            "modified_count": result.modified_count,
        }

    @staticmethod
    async def create_raw_obd_payload(payload: ObdRawPayloadModel, user_id: int):
        db = get_mongo_db()

        doc = payload.to_mongo()
        doc["created_by"] = user_id

        result = await db.obd_raw_payloads.insert_one(doc)
        return {
            "status": "success",
            "message": "Payload OBD brut enregistré",
            "id": str(result.inserted_id),
        }

    @staticmethod
    async def list_raw_obd_payloads(limit: int = 50, vehicle_id: int | None = None):
        db = get_mongo_db()

        query: dict = {}
        if vehicle_id is not None:
            query["vehicle_id"] = vehicle_id

        cursor = db.obd_raw_payloads.find(query).sort("_id", -1).limit(limit)
        items = []
        async for doc in cursor:
            items.append(ObdRawPayloadModel.from_mongo(doc).model_dump(exclude_none=True))

        return {
            "status": "success",
            "count": len(items),
            "items": items,
        }

    @staticmethod
    async def create_iot_device_log(payload: IotDeviceLogModel, user_id: int):
        db = get_mongo_db()

        doc = payload.to_mongo()
        doc["created_by"] = user_id

        if payload.vehicle_id is not None:
            sql_db = SessionLocal()
            try:
                assert_vehicle_dongle_linked(
                    sql_db,
                    vehicle_id=int(payload.vehicle_id),
                    candidates=[payload.device_id],
                )
            finally:
                sql_db.close()

        result = await db.iot_device_logs.insert_one(doc)

        await OpsService.upsert_device_activity(
            device_id=payload.device_id,
            vehicle_id=payload.vehicle_id,
            status="online",
            metadata={
                "event_type": payload.event_type,
                "level": payload.level,
                "event_at": payload.event_at,
            },
        )

        return {
            "status": "success",
            "message": "Log technique IoT enregistré",
            "id": str(result.inserted_id),
        }

    @staticmethod
    async def list_iot_device_logs(limit: int = 50, vehicle_id: int | None = None, device_id: str | None = None):
        db = get_mongo_db()

        query: dict = {}
        if vehicle_id is not None:
            query["vehicle_id"] = vehicle_id
        if device_id is not None:
            query["device_id"] = device_id

        cursor = db.iot_device_logs.find(query).sort("_id", -1).limit(limit)
        items = []
        async for doc in cursor:
            items.append(IotDeviceLogModel.from_mongo(doc).model_dump(exclude_none=True))

        return {
            "status": "success",
            "count": len(items),
            "items": items,
        }

    @staticmethod
    def _duration_minutes(start_value: str | None, end_value: str | None) -> int | None:
        if not start_value or not end_value:
            return None

        try:
            start_dt = datetime.fromisoformat(start_value.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end_value.replace("Z", "+00:00"))
        except ValueError:
            return None

        return int((end_dt - start_dt).total_seconds() / 60)