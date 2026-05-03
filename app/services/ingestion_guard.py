from app.models.vehicle import Vehicle


def _normalize_candidates(candidates: list[str | None] | None) -> list[str]:
    if not candidates:
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        if item is None:
            continue
        value = str(item).strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(value)
    return cleaned


def _vehicle_aliases(vehicle: Vehicle) -> list[str]:
    aliases = [vehicle.dongle_id, vehicle.autopi_device_id, vehicle.autopi_unit_id]
    return _normalize_candidates(aliases)


def assert_vehicle_dongle_linked(db, vehicle_id: int, candidates: list[str | None] | None) -> str:
    vehicle = db.query(Vehicle).filter(Vehicle.id == int(vehicle_id)).first()
    if not vehicle:
        raise ValueError(f"Ingestion refusee: vehicule #{vehicle_id} introuvable.")

    linked_aliases = _vehicle_aliases(vehicle)
    if not linked_aliases:
        raise ValueError(
            "Ingestion refusee: aucun dongle lie a ce vehicule. "
            "Liez d'abord un dongle depuis la page Vehicles/Devices."
        )

    incoming_aliases = _normalize_candidates(candidates)
    if not incoming_aliases:
        raise ValueError(
            "Ingestion refusee: identifiant dongle manquant dans le message. "
            "Envoyez device_id, dongle_id, autopi_device_id ou autopi_unit_id."
        )

    linked_lower = {item.lower(): item for item in linked_aliases}
    for alias in incoming_aliases:
        key = alias.lower()
        if key in linked_lower:
            return linked_lower[key]

    raise ValueError(
        f"Ingestion refusee: dongle non lie au vehicule #{vehicle_id}. "
        f"Dongle recu={', '.join(incoming_aliases)} | Attendu={', '.join(linked_aliases)}"
    )
