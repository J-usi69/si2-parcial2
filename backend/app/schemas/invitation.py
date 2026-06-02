from datetime import datetime

from pydantic import BaseModel

from app.models.invitation import InvitationStatus


class WorkshopInvitationResponse(BaseModel):
    id: int
    incident_id: int
    workshop_id: int
    tenant_id: int
    status: InvitationStatus
    distance_km: float | None = None
    sent_at: datetime
    expires_at: datetime
    responded_at: datetime | None = None
    response_time_seconds: int | None = None
    # Contexto del incidente para mostrar en la bandeja del taller.
    incident_category: str | None = None
    incident_priority: str | None = None
    incident_address: str | None = None
    incident_status: str | None = None

    model_config = {"from_attributes": True}


def serialize_invitation(inv) -> "WorkshopInvitationResponse":
    incident = inv.incident
    return WorkshopInvitationResponse(
        id=inv.id,
        incident_id=inv.incident_id,
        workshop_id=inv.workshop_id,
        tenant_id=inv.tenant_id,
        status=inv.status,
        distance_km=inv.distance_km,
        sent_at=inv.sent_at,
        expires_at=inv.expires_at,
        responded_at=inv.responded_at,
        response_time_seconds=inv.response_time_seconds,
        incident_category=incident.category.value if incident and incident.category else None,
        incident_priority=incident.priority.value if incident and incident.priority else None,
        incident_address=incident.address if incident else None,
        incident_status=incident.status.value if incident and incident.status else None,
    )
