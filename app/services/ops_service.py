from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt

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
            q_regex = {"$regex": q, "$options": "i"}
            if collection == "devices":
                query = {
                    "$or": [
                        {"device_id": q_regex},
                        {"vin": q_regex},
                        {"status": q_regex},
                    ]
                }
                if str(q).isdigit():
                    query["$or"].append({"vehicle_id": int(q)})
            elif collection == "locations":
                query = {
                    "$or": [
                        {"name": q_regex},
                        {"type": q_regex},
                    ]
                }
            elif collection == "geofences":
                query = {
                    "$or": [
                        {"name": q_regex},
                        {"description": q_regex},
                    ]
                }
            else:
                query = {"name": q_regex}

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

    @staticmethod
    def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        radius_earth_m = 6371000
        d_lat = radians(lat2 - lat1)
        d_lng = radians(lng2 - lng1)
        a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
        c = 2 * asin(sqrt(a))
        return radius_earth_m * c

    @staticmethod
    async def check_geofences(latitude: float, longitude: float, vehicle_id: int | None = None):
        db = get_mongo_db()
        cursor = db.geofences.find({"enabled": {"$ne": False}})

        results = []
        events = []

        async for fence in cursor:
            center_lat = fence.get("center_lat")
            center_lng = fence.get("center_lng")
            radius_m = fence.get("radius_m")

            if center_lat is None or center_lng is None or radius_m is None:
                continue

            distance_m = OpsService._distance_m(latitude, longitude, float(center_lat), float(center_lng))
            inside = distance_m <= float(radius_m)

            geofence_id = str(fence.get("_id"))
            item = {
                "geofence_id": geofence_id,
                "name": fence.get("name"),
                "distance_m": round(distance_m, 2),
                "radius_m": float(radius_m),
                "inside": inside,
            }

            if vehicle_id is not None:
                state_query = {"vehicle_id": vehicle_id, "geofence_id": geofence_id}
                prev_state = await db.geofence_vehicle_state.find_one(state_query)
                previous_inside = prev_state.get("inside") if prev_state else None

                transition = None
                if previous_inside is False and inside is True:
                    transition = "enter"
                elif previous_inside is True and inside is False:
                    transition = "exit"

                await db.geofence_vehicle_state.update_one(
                    state_query,
                    {
                        "$set": {
                            "vehicle_id": vehicle_id,
                            "geofence_id": geofence_id,
                            "inside": inside,
                            "updated_at": _now_iso(),
                        }
                    },
                    upsert=True,
                )

                if transition:
                    event_doc = {
                        "vehicle_id": vehicle_id,
                        "geofence_id": geofence_id,
                        "geofence_name": fence.get("name"),
                        "event": transition,
                        "latitude": latitude,
                        "longitude": longitude,
                        "distance_m": round(distance_m, 2),
                        "created_at": _now_iso(),
                    }
                    await db.geofence_events.insert_one(event_doc)
                    events.append(event_doc)
                    item["transition"] = transition

            results.append(item)

        return {
            "status": "success",
            "vehicle_id": vehicle_id,
            "position": {"latitude": latitude, "longitude": longitude},
            "count": len(results),
            "items": results,
            "events": events,
        }
