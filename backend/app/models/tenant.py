from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Tenant(Base):
    """Un tenant representa un TALLER (relacion 1:1 con Workshop).

    Cada taller registrado en la plataforma obtiene su propio tenant. Sus
    tecnicos, ofertas, invitaciones, metricas y reportes pertenecen al tenant
    y quedan aislados del resto. Los clientes/conductores y el admin de la
    plataforma no pertenecen a ningun tenant (capa plataforma, cross-tenant).
    """

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workshop: Mapped["Workshop | None"] = relationship(back_populates="tenant", uselist=False)
    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    technicians: Mapped[list["Technician"]] = relationship(back_populates="tenant")
