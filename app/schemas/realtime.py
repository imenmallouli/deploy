from pydantic import BaseModel, Field


class RealtimeStreamParams(BaseModel):
    token: str | None = None
    poll_ms: int = Field(default=120000, ge=1000, le=300000)
