import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Charger les variables d'environnement depuis .env
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)

# --- DEBUT DE LA CORRECTION ---
# 1. On cherche d'abord si Render a fourni l'URL globale de production
DATABASE_URL = os.getenv("DATABASE_URL")


# 2. Si DATABASE_URL n'existe pas (sur ton PC en local), on utilise ton localhost
if not DATABASE_URL:
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "mallouliauto")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
    
    DATABASE_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
else:
    # Si on est sur Render, on s'assure d'ajouter le driver 'psycopg2' requis
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
# --- FIN DE LA CORRECTION ---

# Créer l'engine SQLAlchemy
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
print("DATABASE_URL =", DATABASE_URL)
# Créer le SessionLocal pour les transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Dépendance pour obtenir une session DB dans les routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()