from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt

from bson import ObjectId

from app.db.mongodb import get_mongo_db
from app.db.session import SessionLocal
from app.models.vehicle import Vehicle
from app.services.alert_service import AlertService
from app.services.email_service import EmailService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class OpsService:
    @staticmethod
    def _lookup_vehicle_owner_user_id(vehicle_id: int | None) -> int | None:
        if vehicle_id is None:
            return None

        db = SessionLocal()
        try:
            vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
            if not vehicle:
                return None
            return vehicle.driver_id
        except Exception as exc:
            print(f"[OPS] Unable to resolve SQL vehicle owner for vehicle_id={vehicle_id}: {exc}")
            return None
        finally:
            db.close()

    @staticmethod
    def _allowed_vehicle_ids(user_id: int | None) -> list[int] | None:
        if user_id is None:
            return None

        db = SessionLocal()
        try:
            return [row[0] for row in db.query(Vehicle.id).filter(Vehicle.driver_id == user_id).all()]
        finally:
            db.close()

    @staticmethod
    def _serialize(doc: dict):
        payload = dict(doc)
        payload["id"] = str(payload.pop("_id"))
        return payload

    @staticmethod
    def _parse_notification_emails(raw_value: str | None) -> list[str]:
        if not raw_value:
            return []
        # Accept comma-separated list: "a@x.com, b@y.com".
        return [email.strip() for email in str(raw_value).split(",") if email and email.strip()]

    @staticmethod
    def _lookup_vehicle_name_sql(vehicle_id: int | None) -> str | None:
        if vehicle_id is None:
            return None
        db = SessionLocal()
        try:
            vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
            if not vehicle:
                return None
            if vehicle.license_plate:
                return vehicle.license_plate
            make = (vehicle.make or "").strip()
            model = (vehicle.model or "").strip()
            composed = f"{make} {model}".strip()
            return composed or None
        except Exception as exc:
            print(f"[OPS] Unable to resolve vehicle name from SQL for vehicle_id={vehicle_id}: {exc}")
            return None
        finally:
            db.close()

    @staticmethod
    async def _resolve_vehicle_name(vehicle_id: int | None) -> str:
        # Priority: SQL vehicle license_plate -> Mongo device name -> generic label.
        sql_name = OpsService._lookup_vehicle_name_sql(vehicle_id)
        if sql_name:
            return sql_name

        if vehicle_id is not None:
            db = get_mongo_db()
            device = await db.devices.find_one({"vehicle_id": vehicle_id})
            if device:
                for key in ("name", "device_name", "vin", "autopi_device_id"):
                    value = device.get(key)
                    if value:
                        return str(value)

        return "Vehicule"

    @staticmethod
    async def list_items(collection: str, q: str | None = None, owner_user_id: int | None = None):
        db = get_mongo_db()
        query = {}
        if owner_user_id is not None:
            query["owner_user_id"] = owner_user_id
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
                query = {"$or": [{"name": q_regex}, {"type": q_regex}]}
            elif collection == "geofences":
                query = {"$or": [{"name": q_regex}, {"description": q_regex}]}
            else:
                query = {"name": q_regex}

        cursor = db[collection].find(query).sort("_id", -1)
        items = []
        async for doc in cursor:
            items.append(OpsService._serialize(doc))

        return {"status": "success", "count": len(items), "items": items}

    @staticmethod
    async def create_item(collection: str, payload: dict, owner_user_id: int | None = None):
        db = get_mongo_db()
        doc = {**payload, "created_at": _now_iso(), "updated_at": _now_iso()}
        if owner_user_id is not None:
            doc["owner_user_id"] = owner_user_id
        result = await db[collection].insert_one(doc)
        created = await db[collection].find_one({"_id": result.inserted_id})

        if collection == "devices" and created:
            OpsService._sync_vehicle_link_from_device(
                vehicle_id=created.get("vehicle_id"),
                device_id=created.get("device_id"),
                vin=created.get("vin"),
            )

        return {"status": "success", "item": OpsService._serialize(created)}

    @staticmethod
    async def update_item(collection: str, item_id: str, payload: dict, owner_user_id: int | None = None):
        if not ObjectId.is_valid(item_id):
            return {"status": "error", "message": "ID invalide"}

        db = get_mongo_db()
        updates = {k: v for k, v in payload.items() if v is not None}
        updates["updated_at"] = _now_iso()

        filter_query: dict = {"_id": ObjectId(item_id)}
        if owner_user_id is not None:
            filter_query["owner_user_id"] = owner_user_id

        result = await db[collection].update_one(filter_query, {"$set": updates})
        if result.matched_count == 0:
            return {"status": "error", "message": "Item introuvable"}

        updated = await db[collection].find_one(filter_query)
        if not updated:
            return {"status": "error", "message": "Item introuvable"}

        if collection == "devices":
            OpsService._sync_vehicle_link_from_device(
                vehicle_id=updated.get("vehicle_id"),
                device_id=updated.get("device_id"),
                vin=updated.get("vin"),
            )

        return {"status": "success", "item": OpsService._serialize(updated)}

    @staticmethod
    async def delete_item(collection: str, item_id: str, owner_user_id: int | None = None):
        if not ObjectId.is_valid(item_id):
            return {"status": "error", "message": "ID invalide"}

        db = get_mongo_db()
        filter_query: dict = {"_id": ObjectId(item_id)}
        if owner_user_id is not None:
            filter_query["owner_user_id"] = owner_user_id

        result = await db[collection].delete_one(filter_query)
        if result.deleted_count == 0:
            return {"status": "error", "message": "Item introuvable"}
        return {"status": "success", "deleted": True}

    @staticmethod
    async def get_devices_overview(user_id: int | None = None):
        db = get_mongo_db()
        query: dict = {}
        if user_id is not None:
            query["owner_user_id"] = user_id

        total = await db.devices.count_documents(query)
        online = await db.devices.count_documents({**query, "status": "online"})
        offline = await db.devices.count_documents({**query, "status": "offline"})
        warning = await db.devices.count_documents({**query, "status": "warning"})
        return {
            "status": "success",
            "total": total,
            "online": online,
            "offline": offline,
            "warning": warning,
        }

    @staticmethod
    def _lookup_vehicle_identity_sql(vehicle_id: int | None) -> dict:
        """Resolve SQL vehicle details used to enrich Mongo device documents."""
        if vehicle_id is None:
            return {}

        db = SessionLocal()
        try:
            vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
            if not vehicle:
                return {}
            return {
                "vin": vehicle.vin,
                "dongle_id": vehicle.dongle_id,
                "autopi_device_id": vehicle.autopi_device_id,
                "autopi_unit_id": vehicle.autopi_unit_id,
            }
        except Exception as exc:
            print(f"[OPS] Unable to resolve SQL vehicle identity for vehicle_id={vehicle_id}: {exc}")
            return {}
        finally:
            db.close()

    @staticmethod
    def _sync_vehicle_link_from_device(vehicle_id: int | None, device_id: str | None, vin: str | None = None):
        """Mirror device linking done in Mongo to SQL vehicle aliases used by ingestion guard."""
        if vehicle_id is None or not device_id:
            return

        normalized_device_id = str(device_id).strip()
        if not normalized_device_id:
            return

        db = SessionLocal()
        try:
            vehicle = db.query(Vehicle).filter(Vehicle.id == int(vehicle_id)).first()
            if not vehicle:
                return

            if not vehicle.dongle_id:
                vehicle.dongle_id = normalized_device_id

            if vin and not vehicle.vin:
                vehicle.vin = vin

            db.commit()
        except Exception as exc:
            db.rollback()
            print(
                f"[OPS] Unable to sync device->vehicle link vehicle_id={vehicle_id} "
                f"device_id={normalized_device_id}: {exc}"
            )
        finally:
            db.close()

    @staticmethod
    async def upsert_device_activity(
        device_id: str | None,
        vehicle_id: int | None = None,
        status: str = "online",
        metadata: dict | None = None,
    ):
        """Create/update a device record so Devices page reflects live dongle activity."""
        db = get_mongo_db()
        now_iso = _now_iso()

        # Fallback to an existing linked device when source payload does not include device_id.
        effective_device_id = (device_id or "").strip() or None
        if not effective_device_id and vehicle_id is not None:
            existing = await db.devices.find_one({"vehicle_id": vehicle_id}, sort=[("updated_at", -1)])
            if existing and existing.get("device_id"):
                effective_device_id = str(existing.get("device_id"))

        if not effective_device_id:
            return {"status": "skipped", "reason": "device_id manquant"}

        vehicle_identity = OpsService._lookup_vehicle_identity_sql(vehicle_id)
        owner_user_id = OpsService._lookup_vehicle_owner_user_id(vehicle_id)
        set_doc = {
            "status": status,
            "updated_at": now_iso,
        }
        if vehicle_id is not None:
            set_doc["vehicle_id"] = int(vehicle_id)
        if owner_user_id is not None:
            set_doc["owner_user_id"] = int(owner_user_id)
        if vehicle_identity.get("vin"):
            set_doc["vin"] = vehicle_identity["vin"]

        # Keep useful linkage aliases so future mapping is robust.
        aliases = []
        for alias in (
            effective_device_id,
            vehicle_identity.get("dongle_id"),
            vehicle_identity.get("autopi_device_id"),
            vehicle_identity.get("autopi_unit_id"),
        ):
            if alias:
                aliases.append(str(alias))
        if aliases:
            set_doc["aliases"] = sorted(set(aliases))

        if metadata:
            compact_metadata = {k: v for k, v in metadata.items() if v is not None}
            if compact_metadata:
                set_doc["last_metadata"] = compact_metadata

        await db.devices.update_one(
            {"device_id": effective_device_id},
            {
                "$setOnInsert": {
                    "device_id": effective_device_id,
                    "created_at": now_iso,
                },
                "$set": set_doc,
            },
            upsert=True,
        )

        return {
            "status": "success",
            "device_id": effective_device_id,
            "vehicle_id": vehicle_id,
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
    def _point_in_polygon(lat: float, lng: float, polygon: list[list[float]]) -> bool:
        # Ray casting on [lat, lng] points.
        x = lng
        y = lat
        inside = False
        n = len(polygon)
        j = n - 1
        for i in range(n):
            yi = polygon[i][0]
            xi = polygon[i][1]
            yj = polygon[j][0]
            xj = polygon[j][1]

            intersects = ((yi > y) != (yj > y)) and (
                x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
            )
            if intersects:
                inside = not inside
            j = i

        return inside

    @staticmethod
    async def check_geofences(
        latitude: float,
        longitude: float,
        vehicle_id: int | None = None,
        owner_user_id: int | None = None,
    ):
        db = get_mongo_db()
        query: dict = {"enabled": {"$ne": False}}
        if owner_user_id is not None:
            query["owner_user_id"] = owner_user_id
        cursor = db.geofences.find(query)

        results = []
        events = []

        async for fence in cursor:
            polygon = fence.get("polygon")
            center_lat = fence.get("center_lat")
            center_lng = fence.get("center_lng")
            radius_m = fence.get("radius_m")

            if polygon and len(polygon) >= 3:
                inside = OpsService._point_in_polygon(latitude, longitude, polygon)
                distance_m = 0.0
            elif center_lat is not None and center_lng is not None and radius_m is not None:
                distance_m = OpsService._distance_m(latitude, longitude, float(center_lat), float(center_lng))
                inside = distance_m <= float(radius_m)
            else:
                continue

            geofence_id = str(fence.get("_id"))
            item = {
                "geofence_id": geofence_id,
                "name": fence.get("name"),
                "distance_m": round(distance_m, 2),
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
                    inserted = await db.geofence_events.insert_one(event_doc)
                    safe_event = {
                        key: (str(value) if isinstance(value, ObjectId) else value)
                        for key, value in event_doc.items()
                    }
                    safe_event["event_id"] = str(inserted.inserted_id)
                    events.append(safe_event)
                    item["transition"] = transition

                    if transition == "exit":
                        # Always create an in-app alert for geofence exit
                        zone_name = fence.get("name", "Zone")
                        AlertService.create_alert_system(
                            vehicle_id=vehicle_id,
                            type="geofence_exit",
                            severity="info",
                            title=f"Sortie de zone : {zone_name}",
                            message=(
                                f"Le véhicule a quitté la zone « {zone_name} » "
                                f"(lat={round(latitude, 5)}, lng={round(longitude, 5)})."
                            ),
                        )

                        monitoring = await db.geofence_monitoring.find_one(
                            {"geofence_id": geofence_id, "vehicle_ids": vehicle_id, "enabled": {"$ne": False}}
                        )
                        if monitoring and monitoring.get("notification_email"):
                            vehicle_name = await OpsService._resolve_vehicle_name(vehicle_id)
                            recipients = OpsService._parse_notification_emails(
                                monitoring.get("notification_email")
                            )
                            for recipient in recipients:
                                EmailService.send_geofence_exit_notification(
                                    recipient_email=recipient,
                                    vehicle_id=vehicle_id,
                                    vehicle_license_plate=vehicle_name,
                                    geofence_name=fence.get("name", "Zone"),
                                    latitude=latitude,
                                    longitude=longitude,
                                )

            results.append(item)

        return {
            "status": "success",
            "vehicle_id": vehicle_id,
            "position": {"latitude": latitude, "longitude": longitude},
            "count": len(results),
            "items": results,
            "events": events,
        }

    @staticmethod
    async def setup_geofence_monitoring(payload, owner_user_id: int | None = None):
        db = get_mongo_db()

        if not ObjectId.is_valid(payload.geofence_id):
            return {"status": "error", "message": "ID geocloture invalide"}

        geofence_query: dict = {"_id": ObjectId(payload.geofence_id)}
        if owner_user_id is not None:
            geofence_query["owner_user_id"] = owner_user_id
        geofence = await db.geofences.find_one(geofence_query)
        if not geofence:
            return {"status": "error", "message": "Geocloture introuvable"}

        config = {
            "geofence_id": payload.geofence_id,
            "geofence_name": geofence.get("name"),
            "vehicle_ids": payload.vehicle_ids,
            "notification_email": payload.notification_email,
            "enabled": True,
            "updated_at": _now_iso(),
        }

        existing = await db.geofence_monitoring.find_one({"geofence_id": payload.geofence_id})
        if existing:
            await db.geofence_monitoring.update_one({"_id": existing["_id"]}, {"$set": config})
            config_id = str(existing["_id"])
        else:
            config["created_at"] = _now_iso()
            inserted = await db.geofence_monitoring.insert_one(config)
            config_id = str(inserted.inserted_id)

        return {
            "status": "success",
            "message": "Configuration de monitoring sauvegardee",
            "config_id": config_id,
        }

    @staticmethod
    async def handle_geofence_exit(payload):
        db = get_mongo_db()

        if not ObjectId.is_valid(payload.geofence_id):
            return {"status": "error", "message": "ID geocloture invalide"}

        notification_email = payload.notification_email
        if not notification_email:
            monitoring = await db.geofence_monitoring.find_one(
                {"geofence_id": payload.geofence_id, "vehicle_ids": payload.vehicle_id, "enabled": {"$ne": False}}
            )
            if monitoring:
                notification_email = monitoring.get("notification_email")

        if not notification_email:
            return {"status": "error", "message": "Aucune adresse email de notification"}

        recipients = OpsService._parse_notification_emails(notification_email)
        if not recipients:
            return {"status": "error", "message": "Aucune adresse email de notification"}

        geofence = await db.geofences.find_one({"_id": ObjectId(payload.geofence_id)}) or {}
        geofence_name = geofence.get("name", "Zone")
        vehicle_name = await OpsService._resolve_vehicle_name(payload.vehicle_id)

        email_results = {}
        for recipient in recipients:
            email_results[recipient] = EmailService.send_geofence_exit_notification(
                recipient_email=recipient,
                vehicle_id=payload.vehicle_id,
                vehicle_license_plate=vehicle_name,
                geofence_name=geofence_name,
                latitude=payload.latitude,
                longitude=payload.longitude,
            )
        email_sent = any(email_results.values())

        event_doc = {
            "geofence_id": payload.geofence_id,
            "geofence_name": geofence_name,
            "vehicle_id": payload.vehicle_id,
            "event_type": "exit_notification",
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "notification_email": notification_email,
            "notification_emails": recipients,
            "email_results": email_results,
            "email_sent": email_sent,
            "created_at": _now_iso(),
        }

        inserted = await db.geofence_exit_events.insert_one(event_doc)
        return {
            "status": "success",
            "message": "Notification de sortie traitee",
            "email_sent": email_sent,
            "email_results": email_results,
            "event_id": str(inserted.inserted_id),
        }

    @staticmethod
    async def save_vehicle_position(
        vehicle_id: int,
        latitude: float,
        longitude: float,
        speed: float | None = None,
        user_id: int | None = None,
    ):
        if user_id is not None:
            allowed_vehicle_ids = OpsService._allowed_vehicle_ids(user_id)
            if vehicle_id not in allowed_vehicle_ids:
                return

        db = get_mongo_db()
        await db.vehicle_positions.update_one(
            {"vehicle_id": vehicle_id},
            {
                "$set": {
                    "vehicle_id": vehicle_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "speed": speed,
                    "updated_at": _now_iso(),
                }
            },
            upsert=True,
        )

    @staticmethod
    async def get_vehicle_positions(user_id: int | None = None):
        db = get_mongo_db()
        query: dict = {}
        if user_id is not None:
            allowed_vehicle_ids = OpsService._allowed_vehicle_ids(user_id)
            if not allowed_vehicle_ids:
                return {"status": "success", "items": []}
            query["vehicle_id"] = {"$in": allowed_vehicle_ids}

        cursor = db.vehicle_positions.find(query)
        items = []
        async for doc in cursor:
            item = dict(doc)
            item["id"] = str(item.pop("_id"))
            items.append(item)
        return {"status": "success", "items": items}
