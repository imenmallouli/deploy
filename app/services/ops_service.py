from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_mongo_db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class OpsService:
    @staticmethod
    def _serialize(doc: dict):
        payload = dict(doc)
        payload["id"] = str(payload.pop("_id"))
        return payload

    @staticmethod
    async def list_items(collection: str, q: str | None = None):
        db = get_mongo_db()
        query = {}
        if q:
            query = {"name": {"$regex": q, "$options": "i"}}

        cursor = db[collection].find(query).sort("_id", -1)
        items = []
        async for doc in cursor:
            items.append(OpsService._serialize(doc))

        return {"status": "success", "count": len(items), "items": items}

    @staticmethod
    async def create_item(collection: str, payload: dict):
        db = get_mongo_db()
        doc = {**payload, "created_at": _now_iso(), "updated_at": _now_iso()}
        result = await db[collection].insert_one(doc)
        created = await db[collection].find_one({"_id": result.inserted_id})
        return {"status": "success", "item": OpsService._serialize(created)}

    @staticmethod
    async def update_item(collection: str, item_id: str, payload: dict):
        if not ObjectId.is_valid(item_id):
            return {"status": "error", "message": "ID invalide"}

        db = get_mongo_db()
        updates = {k: v for k, v in payload.items() if v is not None}
        updates["updated_at"] = _now_iso()

        await db[collection].update_one({"_id": ObjectId(item_id)}, {"$set": updates})
        updated = await db[collection].find_one({"_id": ObjectId(item_id)})
        if not updated:
            return {"status": "error", "message": "Item introuvable"}
        return {"status": "success", "item": OpsService._serialize(updated)}

    @staticmethod
    async def delete_item(collection: str, item_id: str):
        if not ObjectId.is_valid(item_id):
            return {"status": "error", "message": "ID invalide"}

        db = get_mongo_db()
        result = await db[collection].delete_one({"_id": ObjectId(item_id)})
        if result.deleted_count == 0:
            return {"status": "error", "message": "Item introuvable"}
        return {"status": "success", "deleted": True}

    @staticmethod
    async def get_devices_overview():
        db = get_mongo_db()
        total = await db.devices.count_documents({})
        online = await db.devices.count_documents({"status": "online"})
        offline = await db.devices.count_documents({"status": "offline"})
        warning = await db.devices.count_documents({"status": "warning"})
        return {
            "status": "success",
            "total": total,
            "online": online,
            "offline": offline,
            "warning": warning,
        }
