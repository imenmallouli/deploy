import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)

MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB = os.getenv("MONGO_DB", "mallouliauto")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_USER = os.getenv("MONGO_USER", "")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "")

_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _client

    mongo_uri = MONGO_URI
    if not mongo_uri:
        if MONGO_USER and MONGO_PASSWORD:
            mongo_uri = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}"
        else:
            mongo_uri = f"mongodb://{MONGO_HOST}:{MONGO_PORT}"

    if _client is None:
        _client = AsyncIOMotorClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            tlsAllowInvalidCertificates=True
        )

    return _client


def get_mongo_db() -> AsyncIOMotorDatabase:
    client = get_mongo_client()
    return client[MONGO_DB]