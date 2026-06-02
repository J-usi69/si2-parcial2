import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.services import nl_report_service, report_export_service
from app.utils.security import get_current_user
from app.utils.tenancy import get_user_workshop

router = APIRouter(prefix="/api/reports", tags=["Reportes"])


class ReportRequest(BaseModel):
    prompt: str


class ReportExportRequest(BaseModel):
    title: str = "Reporte"
    columns: list[str]
    rows: list[list]
    format: str  # xlsx | docx | pdf


def _scope(current_user: User, db: Session) -> int | None:
    """Reportes orientados a admin (global) y talleres (su tenant)."""
    if current_user.role == UserRole.ADMIN:
        return None
    if current_user.role == UserRole.WORKSHOP:
        workshop = get_user_workshop(db, current_user)
        if not workshop:
            raise HTTPException(status_code=404, detail="No tiene taller registrado")
        return workshop.tenant_id
    raise HTTPException(status_code=403, detail="No tiene permisos para generar reportes")


@router.post("/generate")
def generate_report(
    data: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Convierte un prompt en una consulta SQL segura y devuelve el resultado."""
    tenant_id = _scope(current_user, db)
    try:
        return nl_report_service.generate_report(db, data.prompt, tenant_id)
    except nl_report_service.ReportError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/export")
def export_report(
    data: ReportExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exporta un reporte ya generado a Excel, Word o PDF."""
    _scope(current_user, db)  # valida permisos
    fmt = (data.format or "").lower()
    if fmt not in report_export_service.EXPORTERS:
        raise HTTPException(status_code=400, detail="Formato invalido (use xlsx, docx o pdf)")
    builder, media_type = report_export_service.EXPORTERS[fmt]
    content = builder(data.title, data.columns, data.rows)
    filename = f"reporte.{fmt}"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
