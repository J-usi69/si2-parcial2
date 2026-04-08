from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    incident_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewResponse(BaseModel):
    id: int
    incident_id: int
    user_id: int
    workshop_id: int
    rating: int
    comment: str | None
    created_at: datetime
    user_name: str | None = None

    model_config = {"from_attributes": True}
