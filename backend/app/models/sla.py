from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ServiceCategorySLA(Base):
    """Tiempos esperados (SLA) por categoria de incidente.

    Alimenta el KPI "servicios atendidos dentro del tiempo esperado".
    Una fila con tenant_id NULL es el valor por defecto global; un tenant
    puede sobrescribir el SLA de una categoria con su propia fila.
    """

    __tablename__ = "service_category_sla"
    __table_args__ = (
        UniqueConstraint("tenant_id", "category", name="uq_sla_tenant_category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(50))
    expected_assignment_min: Mapped[int] = mapped_column(Integer, default=10)
    expected_arrival_min: Mapped[int] = mapped_column(Integer, default=30)
    expected_completion_min: Mapped[int] = mapped_column(Integer, default=90)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
