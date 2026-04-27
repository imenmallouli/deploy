import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.schemas.realtime import RealtimeStreamParams
from app.services.realtime_service import RealtimeService

router = APIRouter(prefix="/realtime", tags=["Realtime"])


@router.get("/info")
async def realtime_info():
    return {
        "status": "success",
        "module": "realtime",
        "description": "Documentation HTTP pour le flux WebSocket temps réel.",
        "websocket": {
            "route": "/api/v1/realtime/ws/vehicles/{vehicle_id}",
            "method": "WS",
            "query_params": {
                "token": "JWT optionnel (Bearer token)",
                "poll_ms": "Intervalle polling Mongo en ms (1000 à 60000, défaut 60000)",
            },
            "example": "ws://127.0.0.1:8000/api/v1/realtime/ws/vehicles/1?token=<JWT>&poll_ms=60000",
        },
        "event_format": {
            "event": "telemetry_update",
            "vehicle_id": 1,
            "timestamp": "2026-03-03T10:30:00+00:00",
            "metrics": {
                "speed": 84.2,
                "rpm": 2310,
                "fuel_level": 41.8,
                "engine_temp": 102.4,
                "battery_voltage": 12.1,
            },
            "predictive_signals": [
                {
                    "type": "overheat_warning",
                    "severity": "warning",
                    "message": "Température moteur élevée (>= 100°C)",
                    "recommendation": "Planifier une inspection du système de refroidissement.",
                }
            ],
        },
    }


@router.websocket("/ws/vehicles/{vehicle_id}")
async def ws_vehicle_realtime(
    websocket: WebSocket,
    vehicle_id: int,
    token: str | None = Query(default=None),
    poll_ms: int = Query(default=60000, ge=1000, le=60000),
):
    try:
        params = RealtimeStreamParams(token=token, poll_ms=poll_ms)
    except Exception:
        await websocket.close(code=1003)
        return

    try:
        RealtimeService.validate_ws_token(params.token)
    except ValueError:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    last_seen_id: str | None = None

    try:
        while True:
            event, next_seen_id = await RealtimeService.get_latest_event(
                vehicle_id=vehicle_id,
                last_seen_id=last_seen_id,
            )
            if event is not None:
                await websocket.send_json(event.model_dump())
                last_seen_id = next_seen_id

            await asyncio.sleep(params.poll_ms / 1000)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)
