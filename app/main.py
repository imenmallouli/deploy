from fastapi import FastAPI

from app.api.v1 import alert, auth, database, fleet, vehicle
# Import les modèles pour enregistrer les tables
from app.models import alert as alert_model
from app.models import fleet as fleet_model
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


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Auto Diagnostic Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }
