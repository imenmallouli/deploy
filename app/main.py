from fastapi import FastAPI

from app.api.v1 import database, auth, fleet
# Import les modèles pour enregistrer les tables
from app.models import user, fleet as fleet_model

app = FastAPI(
    title="Auto Diagnostic Platform API",
    description="API pour le diagnostic automatique de véhicules",
    version="1.0.0"
)

# Inclure les routers

app.include_router(database.router, prefix="/api/v1", tags=["Database"])
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(fleet.router, prefix="/api/v1", tags=["Fleets"])


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Auto Diagnostic Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }
