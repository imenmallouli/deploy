from fastapi import FastAPI

from app.api.v1 import health

app = FastAPI(
    title="Auto Diagnostic Platform API",
    description="API pour le diagnostic automatique de véhicules",
    version="1.0.0"
)

# Inclure les routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Auto Diagnostic Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }
