from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    """Vérification simple de l'état de l'API"""
    return {"status": "healthy", "service": "Auto Diagnostic Platform API"}


@router.get("/health/db")
def database_health_check(db: Session = Depends(get_db)):
    """Vérification de la connexion à la base de données PostgreSQL"""
    try:
        # Exécuter une requête simple pour tester la connexion
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "message": "PostgreSQL connection successful"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }
