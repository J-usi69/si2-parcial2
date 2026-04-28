from datetime import datetime

from pydantic import BaseModel

from app.models.offer import OfferStatus


class ServiceOfferCreate(BaseModel):
    cost: float
    estimated_arrival: int
    technician_id: int | None = None
    message: str | None = None


class OfferAcceptRequest(BaseModel):
    payment_method: str = "card"


class ServiceOfferResponse(BaseModel):
    id: int
    incident_id: int
    workshop_id: int
    technician_id: int | None
    cost: float
    estimated_arrival: int
    distance_km: float
    score: float
    recommendation_reason: str | None
    message: str | None
    status: OfferStatus
    created_at: datetime
    workshop_name: str | None = None
    workshop_rating: float | None = None
    workshop_total_ratings: int | None = None
    technician_name: str | None = None
    is_recommended: bool = False

    model_config = {"from_attributes": True}
