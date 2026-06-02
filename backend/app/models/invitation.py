import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"      # enviada, esperando respuesta del taller
    ACCEPTED = "accepted"    # el taller dijo "yo atiendo"
    REJECTED = "rejected"    # el taller dijo "no"
    EXPIRED = "expired"      # no respondio dentro del tiempo limite (resta puntos)


class WorkshopInvitation(Base):
    """Invitacion que la plataforma envia a un taller para atender una emergencia.

    La app decide a QUE talleres invita (no a todos) segun distancia,
    especialidad y reputacion. Cada taller responde si/no dentro de un tiempo
    limite; no responder marca la invitacion EXPIRED y penaliza su reputacion.
    """

    __tablename__ = "workshop_invitations"
    __table_args__ = (
        UniqueConstraint("incident_id", "workshop_id", name="uq_invitation_incident_workshop"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"), index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)

    status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus), default=InvitationStatus.PENDING, index=True
    )
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)

    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    response_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    incident: Mapped["Incident"] = relationship()
    workshop: Mapped["Workshop"] = relationship(back_populates="invitations")
