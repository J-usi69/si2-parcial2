from datetime import datetime

from pydantic import BaseModel

from app.models.incident import IncidentCategory, IncidentPriority, IncidentStatus


class IncidentCreate(BaseModel):
    vehicle_id: int
    latitude: float
    longitude: float
    address: str | None = None
    description: str | None = None
    client_uuid: str | None = None  # idempotencia para sync offline


class IncidentUpdate(BaseModel):
    status: IncidentStatus | None = None
    final_cost: float | None = None
    estimated_arrival: int | None = None


class EvidenceResponse(BaseModel):
    id: int
    type: str
    file_url: str | None
    content: str | None
    transcription: str | None
    ai_analysis: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class StatusHistoryResponse(BaseModel):
    id: int
    status: str
    notes: str | None
    changed_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentResponse(BaseModel):
    id: int
    user_id: int
    vehicle_id: int
    workshop_id: int | None
    technician_id: int | None
    category: IncidentCategory
    priority: IncidentPriority
    status: IncidentStatus
    description: str | None
    ai_summary: str | None
    ai_diagnosis: str | None
    latitude: float
    longitude: float
    address: str | None
    estimated_arrival: int | None
    final_cost: float | None
    commission_amount: float | None
    created_at: datetime
    updated_at: datetime
    evidences: list[EvidenceResponse] = []
    status_history: list[StatusHistoryResponse] = []
    workshop_name: str | None = None
    technician_name: str | None = None
    technician_latitude: float | None = None
    technician_longitude: float | None = None
    technician_last_location_at: datetime | None = None

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    id: int
    user_id: int
    vehicle_id: int
    workshop_id: int | None
    category: IncidentCategory
    priority: IncidentPriority
    status: IncidentStatus
    description: str | None
    ai_summary: str | None
    latitude: float
    longitude: float
    address: str | None
    final_cost: float | None
    commission_amount: float | None
    created_at: datetime

    model_config = {"from_attributes": True}
