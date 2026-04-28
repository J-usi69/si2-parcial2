import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OfferStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ServiceOffer(Base):
    __tablename__ = "service_offers"
    __table_args__ = (UniqueConstraint("incident_id", "workshop_id", name="uq_offer_incident_workshop"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"))
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"))
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("technicians.id"), nullable=True)
    cost: Mapped[float] = mapped_column(Float)
    estimated_arrival: Mapped[int] = mapped_column(Integer)
    distance_km: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    recommendation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[OfferStatus] = mapped_column(Enum(OfferStatus), default=OfferStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    incident: Mapped["Incident"] = relationship()
    workshop: Mapped["Workshop"] = relationship()
    technician: Mapped["Technician | None"] = relationship()
