from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine, get_db

router = APIRouter(tags=["Database"])


@router.post("/create-tables")
def create_tables():
    """Crée toutes les tables dans PostgreSQL"""
    try:
        Base.metadata.create_all(bind=engine)
        return {
            "status": "success",
            "message": "Tables créées avec succès dans PostgreSQL"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("/list-tables")
def list_tables(db: Session = Depends(get_db)):
    """Vérifie les tables existantes dans PostgreSQL"""
    try:
        result = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """))
        tables = [row[0] for row in result]
        return {
            "status": "success",
            "tables": tables
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.post("/sync-schema")
def sync_schema(db: Session = Depends(get_db)):
    """Ajoute les colonnes nécessaires pour RBAC/flottes si elles n'existent pas."""
    try:
        db.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'driver'
        """))

        db.execute(text("""
            ALTER TABLE fleets
            ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id)
        """))

        db.commit()
        return {
            "status": "success",
            "message": "Schéma synchronisé avec succès"
        }
    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "message": str(e)
        }
