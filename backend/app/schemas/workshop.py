from datetime import datetime

from pydantic import BaseModel


class WorkshopCreate(BaseModel):
    name: str
    description: str | None = None
    address: str
    latitude: float
    longitude: float
    phone: str
    capacity: int = 5
    services: str = "battery,tire,crash,engine,other"


class WorkshopUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    phone: str | None = None
    is_available: bool | None = None
    capacity: int | None = None
    services: str | None = None


class WorkshopResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None
    address: str
    latitude: float
    longitude: float
    phone: str
    is_available: bool
    capacity: int
    services: str
    rating: float
    total_ratings: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TechnicianCreate(BaseModel):
    name: str
    phone: str
    specialties: str = "battery,tire,crash,engine,other"
    email: str | None = None
    password: str | None = None


class TechnicianUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    specialties: str | None = None
    email: str | None = None
    password: str | None = None
    is_available: bool | None = None
    latitude: float | None = None
    longitude: float | None = None


class TechnicianResponse(BaseModel):
    id: int
    workshop_id: int
    user_id: int | None
    user_email: str | None
    name: str
    phone: str
    specialties: str
    is_available: bool
    latitude: float | None
    longitude: float | None
    last_location_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TechnicianLocationUpdate(BaseModel):
    latitude: float
    longitude: float
