from datetime import datetime

from bson import ObjectId

from app.db.mongodb import get_mongo_db
from app.models.dtc import DtcEventModel


class DtcService:
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

        result = await db.dtc_events.insert_one(doc)
        return {
            "status": "success",
            "message": "DTC event créé",
            "id": str(result.inserted_id),
        }

    @staticmethod
    async def list_dtc_events(limit: int = 50):
        db = get_mongo_db()

        cursor = db.dtc_events.find().sort("_id", -1).limit(limit)
        items = []
        async for doc in cursor:
            items.append(DtcEventModel.from_mongo(doc).model_dump(exclude_none=True))

        return {
            "status": "success",
            "count": len(items),
            "items": items,
        }

    @staticmethod
    async def list_dtc_by_vehicle(vehicle_id: int, limit: int = 50):
        db = get_mongo_db()

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

        first = docs[0]
        return {
            "status": "success",
            "dtc_code": first.code,
            "vehicle_id": first.vehicle_id,
            "total_occurrences": len(docs),
            "history": history,
        }

    @staticmethod
    async def clear_dtc(role: str, user_id: int, vehicle_id: int, dtc_code: str | None = None):
        role = (role or "driver").strip().lower()
        if role not in {"admin", "manager"}:
            return {"status": "error", "message": "Accès refusé"}

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
    def _duration_minutes(start_value: str | None, end_value: str | None) -> int | None:
        if not start_value or not end_value:
            return None

        try:
            start_dt = datetime.fromisoformat(start_value.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end_value.replace("Z", "+00:00"))
        except ValueError:
            return None

        return int((end_dt - start_dt).total_seconds() / 60)