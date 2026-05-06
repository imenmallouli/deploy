from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_mongo_db


class MaintenanceService:
    @staticmethod
    def _normalize_dtc_codes(raw_codes: list[str] | None) -> list[str]:
        if not raw_codes:
            return []
        normalized: list[str] = []
        seen: set[str] = set()
        for code in raw_codes:
            value = str(code or "").strip().upper()
            if value and value not in seen:
                normalized.append(value)
                seen.add(value)
        return normalized

    @staticmethod
    async def list_records(vehicle_id: int, limit: int = 100):
        db = get_mongo_db()
        cursor = db.maintenance_records.find({"vehicle_id": int(vehicle_id)}).sort([("created_at", -1), ("_id", -1)]).limit(limit)
        docs = await cursor.to_list(length=limit)

        items: list[dict] = []
        for doc in docs:
            items.append(
                {
                    "id": str(doc.get("_id")),
                    "vehicle_id": int(doc.get("vehicle_id") or vehicle_id),
                    "component": str(doc.get("component") or "").strip().lower(),
                    "serviced_at_odometer": float(doc.get("serviced_at_odometer") or 0),
                    "valid_for_km": float(doc.get("valid_for_km") or 3000),
                    "resolved_dtc_codes": MaintenanceService._normalize_dtc_codes(doc.get("resolved_dtc_codes") or []),
                    "note": str(doc.get("note") or "").strip(),
                    "technicien": doc.get("technicien") or None,
                    "urgency": doc.get("urgency") or None,
                    "date_intervention": doc.get("date_intervention") or None,
                    "created_at": doc.get("created_at"),
                    "created_by": doc.get("created_by"),
                }
            )

        return {
            "status": "success",
            "count": len(items),
            "items": items,
        }

    @staticmethod
    async def create_record(payload: dict, user_id: int):
        db = get_mongo_db()

        doc = {
            "vehicle_id": int(payload["vehicle_id"]),
            "component": str(payload["component"]).strip().lower(),
            "serviced_at_odometer": float(payload.get("serviced_at_odometer") or 0),
            "valid_for_km": float(payload.get("valid_for_km") or 0),
            "resolved_dtc_codes": MaintenanceService._normalize_dtc_codes(payload.get("resolved_dtc_codes") or []),
            "note": str(payload.get("note") or "").strip(),
            "technicien": str(payload["technicien"]).strip() if payload.get("technicien") else None,
            "urgency": str(payload["urgency"]).strip() if payload.get("urgency") else None,
            "date_intervention": str(payload["date_intervention"]).strip() if payload.get("date_intervention") else None,
            "created_at": datetime.now(timezone.utc),
            "created_by": int(user_id),
        }

        result = await db.maintenance_records.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)

        return {
            "status": "success",
            "message": "Maintenance task saved",
            "item": doc,
        }

    @staticmethod
    async def delete_record(record_id: str):
        db = get_mongo_db()
        if not ObjectId.is_valid(record_id):
            return {"status": "error", "message": "Invalid maintenance record id"}

        result = await db.maintenance_records.delete_one({"_id": ObjectId(record_id)})
        if result.deleted_count == 0:
            return {"status": "error", "message": "Maintenance record not found"}

        return {
            "status": "success",
            "message": "Maintenance task deleted",
        }
