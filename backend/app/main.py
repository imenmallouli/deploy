from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import ai, alert, auth, database, dtc, fleet, maintenance, ops, realtime, telemetry, vehicle
from app.services.autopi_bridge_runner import start_autopi_bridge, stop_autopi_bridge
# Import les modèles pour enregistrer les tables
from app.models import alert as alert_model
from app.models import fleet as fleet_model
from app.models import telemetry as telemetry_model
from app.models import user, vehicle as vehicle_model

@asynccontextmanager
async def lifespan(_: FastAPI):
    start_autopi_bridge()
    try:
        yield
    finally:
        stop_autopi_bridge()


app = FastAPI(
    title="Auto Diagnostic Platform API",
    description="API pour le diagnostic automatique de véhicules",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routers

app.include_router(database.router, prefix="/api/v1", tags=["Database"])
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(fleet.router, prefix="/api/v1", tags=["Fleets"])
app.include_router(vehicle.router, prefix="/api/v1", tags=["Vehicles"])
app.include_router(alert.router, prefix="/api/v1", tags=["Alerts"])
app.include_router(dtc.router, prefix="/api/v1", tags=["DTC"])
app.include_router(telemetry.router, prefix="/api/v1", tags=["Telemetry"])
app.include_router(realtime.router, prefix="/api/v1", tags=["Realtime"])
app.include_router(ai.router, prefix="/api/v1", tags=["AI"])
app.include_router(maintenance.router, prefix="/api/v1", tags=["Maintenance"])
app.include_router(ops.router, prefix="/api/v1", tags=["Ops"])


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Auto Diagnostic Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)
