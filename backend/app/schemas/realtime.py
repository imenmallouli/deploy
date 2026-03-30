from pydantic import BaseModel, Field


class RealtimeStreamParams(BaseModel):
    token: str | None = None
    poll_ms: int = Field(default=1500, ge=500, le=10000)
