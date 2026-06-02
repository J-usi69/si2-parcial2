import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IncidentCategory(str, enum.Enum):
    BATTERY = "battery"
    TIRE = "tire"
    CRASH = "crash"
    ENGINE = "engine"
    KEYS = "keys"
    OTHER = "other"
    UNCERTAIN = "uncertain"


class IncidentPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    # tenant_id se fija al tenant (taller) ganador cuando se acepta una oferta.
    # Mientras esta PENDING es NULL (incidente cross-tenant en la capa plataforma).
    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id"), nullable=True, index=True)
    workshop_id: Mapped[int | None] = mapped_column(ForeignKey("workshops.id"), nullable=True)
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("technicians.id"), nullable=True)

    category: Mapped[IncidentCategory] = mapped_column(
        Enum(IncidentCategory), default=IncidentCategory.UNCERTAIN
    )
    priority: Mapped[IncidentPriority] = mapped_column(
        Enum(IncidentPriority), default=IncidentPriority.MEDIUM
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus), default=IncidentStatus.PENDING
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)

    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    estimated_arrival: Mapped[int | None] = mapped_column(nullable=True)  # minutos
    final_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    commission_amount: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Timestamps del ciclo de vida (alimentan los KPIs de tiempos).
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    en_route_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship(back_populates="incidents")
    tenant: Mapped["Tenant | None"] = relationship()
    vehicle: Mapped["Vehicle"] = relationship(back_populates="incidents")
    workshop: Mapped["Workshop | None"] = relationship(back_populates="incidents")
    technician: Mapped["Technician | None"] = relationship(back_populates="incidents")
    evidences: Mapped[list["Evidence"]] = relationship(back_populates="incident", cascade="all, delete-orphan")
    status_history: Mapped[list["StatusHistory"]] = relationship(back_populates="incident", cascade="all, delete-orphan")
    payment: Mapped["Payment | None"] = relationship(back_populates="incident", uselist=False)

    @hybrid_property
    def workshop_name(self) -> str | None:
        return self.workshop.name if self.workshop else None

    @hybrid_property
    def technician_name(self) -> str | None:
        return self.technician.name if self.technician else None

    @hybrid_property
    def technician_latitude(self) -> float | None:
        return self.technician.latitude if self.technician else None

    @hybrid_property
    def technician_longitude(self) -> float | None:
        return self.technician.longitude if self.technician else None

    @hybrid_property
    def technician_last_location_at(self) -> datetime | None:
        return self.technician.last_location_at if self.technician else None
