from fastapi import FastAPI, Response

from app.api.v1 import alert, auth, database, dtc, fleet, telemetry, vehicle
# Import les modèles pour enregistrer les tables
from app.models import alert as alert_model
from app.models import fleet as fleet_model
from app.models import telemetry as telemetry_model
from app.models import user, vehicle as vehicle_model

app = FastAPI(
    title="Auto Diagnostic Platform API",
    description="API pour le diagnostic automatique de véhicules",
    version="1.0.0"
)

# Inclure les routers

app.include_router(database.router, prefix="/api/v1", tags=["Database"])
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(fleet.router, prefix="/api/v1", tags=["Fleets"])
app.include_router(vehicle.router, prefix="/api/v1", tags=["Vehicles"])
app.include_router(alert.router, prefix="/api/v1", tags=["Alerts"])
app.include_router(dtc.router, prefix="/api/v1", tags=["DTC"])
app.include_router(telemetry.router, prefix="/api/v1", tags=["Telemetry"])


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
