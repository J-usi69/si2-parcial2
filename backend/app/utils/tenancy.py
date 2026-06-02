"""Utilidades de multitenancy.

Modelo: cada TALLER es su propio tenant (1:1). Los usuarios WORKSHOP y
TECHNICIAN pertenecen a un tenant (tienen tenant_id); CLIENT y el ADMIN de
plataforma no (tenant_id NULL, capa cross-tenant). El backend filtra los datos
de taller por el tenant del usuario autenticado; el ADMIN ve todos los tenants.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.models.workshop import Workshop
from app.utils.security import get_current_user


def require_tenant(current_user: User = Depends(get_current_user)) -> int:
    """Dependencia FastAPI: exige que el usuario pertenezca a un tenant (taller)."""
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta no pertenece a ningun tenant (taller)",
        )
    return current_user.tenant_id


def get_user_workshop(db: Session, user: User) -> Workshop | None:
    """Taller del tenant del usuario (sirve para WORKSHOP y TECHNICIAN)."""
    if user.tenant_id is None:
        return None
    return db.query(Workshop).filter(Workshop.tenant_id == user.tenant_id).first()


def scope_to_tenant(query, model, user: User):
    """Filtra una query por el tenant del usuario.

    El ADMIN de plataforma no se filtra (ve todos los tenants). Para clientes u
    otros sin tenant, fuerza un resultado vacio en tablas tenant-scoped.
    """
    if user.role == UserRole.ADMIN:
        return query
    if user.tenant_id is None:
        return query.filter(model.tenant_id == None)  # noqa: E711
    return query.filter(model.tenant_id == user.tenant_id)


def create_tenant_for_workshop(db: Session, name: str, contact_phone: str | None = None) -> Tenant:
    """Crea el Tenant 1:1 de un taller nuevo, con slug unico estable."""
    tenant = Tenant(name=name, slug=f"pending", contact_phone=contact_phone, is_active=True)
    db.add(tenant)
    db.flush()  # obtiene tenant.id
    tenant.slug = f"taller-{tenant.id}"
    return tenant
