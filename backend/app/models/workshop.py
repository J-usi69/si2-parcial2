from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Workshop(Base):
    __tablename__ = "workshops"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # Relacion 1:1 con Tenant: cada taller es su propio tenant.
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str] = mapped_column(String(500))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    phone: Mapped[str] = mapped_column(String(50))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    capacity: Mapped[int] = mapped_column(Integer, default=5)
    services: Mapped[str] = mapped_column(String(500), default="battery,tire,crash,engine,other")
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    total_ratings: Mapped[int] = mapped_column(Integer, default=0)
    commission_rate: Mapped[float] = mapped_column(Float, default=0.10)
    # Reputacion del taller frente a invitaciones (politica de puntos).
    reputation_points: Mapped[int] = mapped_column(Integer, default=100)
    invitations_sent: Mapped[int] = mapped_column(Integer, default=0)
    invitations_accepted: Mapped[int] = mapped_column(Integer, default=0)
    invitations_ignored: Mapped[int] = mapped_column(Integer, default=0)
    avg_response_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="workshop")
    user: Mapped["User"] = relationship(back_populates="workshop")
    technicians: Mapped[list["Technician"]] = relationship(back_populates="workshop")
    incidents: Mapped[list["Incident"]] = relationship(back_populates="workshop")
    invitations: Mapped[list["WorkshopInvitation"]] = relationship(back_populates="workshop")


class Technician(Base):
    __tablename__ = "technicians"
    __table_args__ = (UniqueConstraint("user_id", name="uq_technicians_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(50))
    specialties: Mapped[str] = mapped_column(String(500), default="battery,tire,crash,engine,other")
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_location_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="technicians")
    workshop: Mapped["Workshop"] = relationship(back_populates="technicians")
    user: Mapped["User | None"] = relationship()
    incidents: Mapped[list["Incident"]] = relationship(back_populates="technician")

    @property
    def user_email(self) -> str | None:
        return self.user.email if self.user else None
