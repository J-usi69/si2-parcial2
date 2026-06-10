import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.evidence import Evidence, EvidenceType
from app.models.incident import Incident, IncidentStatus
from app.models.notification import Notification, NotificationType
from app.models.status_history import StatusHistory
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.models.workshop import Workshop
from app.schemas.incident import (
    IncidentCreate,
    IncidentListResponse,
    IncidentResponse,
    IncidentUpdate,
)
from app.utils.security import get_current_user

from app.services.notification_service import invite_workshops_for_incident, notify_admins_new_incident, notify_user_realtime, send_push_to_user

router = APIRouter(prefix="/api/incidents", tags=["Incidentes"])


@router.post("/", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    data: IncidentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Idempotencia: si ya existe un incidente con este client_uuid, devolverlo
    # (evita duplicados cuando el movil reintenta la sincronizacion offline).
    if data.client_uuid:
        existing = db.query(Incident).filter(Incident.client_uuid == data.client_uuid).first()
        if existing:
            return existing

    vehicle = db.query(Vehicle).filter(
        Vehicle.id == data.vehicle_id, Vehicle.user_id == current_user.id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehiculo no encontrado")

    incident = Incident(
        client_uuid=data.client_uuid,
        user_id=current_user.id,
        vehicle_id=data.vehicle_id,
        latitude=data.latitude,
        longitude=data.longitude,
        address=data.address,
        description=data.description,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Registrar estado inicial
    history = StatusHistory(
        incident_id=incident.id,
        status=IncidentStatus.PENDING.value,
        changed_by=current_user.full_name,
        notes="Incidente creado",
    )
    db.add(history)

    # Si hay descripcion de texto, guardarla como evidencia
    if data.description:
        evidence = Evidence(
            incident_id=incident.id,
            type=EvidenceType.TEXT,
            content=data.description,
        )
        db.add(evidence)

    db.commit()
    db.refresh(incident)

    if data.description:
        from app.services.ai_processor import process_incident
        await process_incident(incident.id, db)
        db.refresh(incident)

    invite_workshops_for_incident(db, incident)
    notify_admins_new_incident(db, incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.post("/{incident_id}/evidence/image", response_model=IncidentResponse)
async def upload_image(
    incident_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(
        Incident.id == incident_id, Incident.user_id == current_user.id
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    # Guardar archivo
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, "images", filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    evidence = Evidence(
        incident_id=incident.id,
        type=EvidenceType.IMAGE,
        file_url=f"/uploads/images/{filename}",
    )
    db.add(evidence)
    db.commit()

    # Procesar con IA en background
    from app.services.ai_processor import process_incident_async
    process_incident_async(incident.id)

    db.refresh(incident)
    return incident


@router.post("/{incident_id}/evidence/audio", response_model=IncidentResponse)
async def upload_audio(
    incident_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(
        Incident.id == incident_id, Incident.user_id == current_user.id
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    ext = os.path.splitext(file.filename)[1] if file.filename else ".webm"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, "audio", filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    evidence = Evidence(
        incident_id=incident.id,
        type=EvidenceType.AUDIO,
        file_url=f"/uploads/audio/{filename}",
    )
    db.add(evidence)
    db.commit()

    # Procesar con IA
    from app.services.ai_processor import process_incident_async
    process_incident_async(incident.id)

    db.refresh(incident)
    return incident


@router.get("/", response_model=list[IncidentListResponse])
def list_incidents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.CLIENT:
        return db.query(Incident).filter(Incident.user_id == current_user.id).order_by(Incident.created_at.desc()).all()
    elif current_user.role == UserRole.WORKSHOP:
        workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
        if not workshop:
            return []
        # Mostrar incidentes asignados al taller + pendientes cercanos
        return db.query(Incident).filter(
            (Incident.workshop_id == workshop.id) | (Incident.status == IncidentStatus.PENDING)
        ).order_by(Incident.created_at.desc()).all()
    elif current_user.role == UserRole.TECHNICIAN:
        from app.models.workshop import Technician
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician:
            return []
        return db.query(Incident).filter(Incident.technician_id == technician.id).order_by(Incident.created_at.desc()).all()
    elif current_user.role == UserRole.ADMIN:
        return db.query(Incident).order_by(Incident.created_at.desc()).all()
    return []


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    # Verificar acceso
    if current_user.role == UserRole.CLIENT and incident.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este incidente")
    if current_user.role == UserRole.WORKSHOP:
        workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
        if not workshop or (incident.workshop_id not in (None, workshop.id) and incident.status != IncidentStatus.PENDING):
            raise HTTPException(status_code=403, detail="Sin acceso a este incidente")
    if current_user.role == UserRole.TECHNICIAN:
        from app.models.workshop import Technician
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or incident.technician_id != technician.id:
            raise HTTPException(status_code=403, detail="Sin acceso a este incidente")

    return incident


@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: int,
    data: IncidentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    if current_user.role == UserRole.WORKSHOP:
        workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
        if not workshop or incident.workshop_id != workshop.id:
            raise HTTPException(status_code=403, detail="Sin acceso a este incidente")
        if data.final_cost is not None or data.estimated_arrival is not None:
            raise HTTPException(status_code=403, detail="El monto y ETA se definen en la oferta aceptada")
        if data.status not in {IncidentStatus.IN_PROGRESS}:
            raise HTTPException(status_code=403, detail="El taller solo puede iniciar el servicio; el cliente lo finaliza con el pago")

    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="El cliente finaliza desde el flujo de pago")

    if current_user.role == UserRole.TECHNICIAN:
        from app.models.workshop import Technician
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or incident.technician_id != technician.id:
            raise HTTPException(status_code=403, detail="Sin acceso a este incidente")
        if data.final_cost is not None or data.estimated_arrival is not None:
            raise HTTPException(status_code=403, detail="El tecnico no puede cambiar el monto")
        if data.status not in {IncidentStatus.IN_PROGRESS}:
            raise HTTPException(status_code=403, detail="El cliente finaliza el servicio con el pago")

    if data.status is not None:
        incident.status = data.status
        # Timestamp de llegada del tecnico (KPI tiempo de llegada).
        if data.status == IncidentStatus.IN_PROGRESS and incident.arrived_at is None:
            incident.arrived_at = datetime.now(timezone.utc)
        _status_labels = {
            "pending": "Pendiente",
            "assigned": "Asignado",
            "in_progress": "En progreso",
            "completed": "Completado",
        }
        status_label = _status_labels.get(data.status.value, data.status.value)
        history = StatusHistory(
            incident_id=incident.id,
            status=data.status.value,
            changed_by=current_user.full_name,
        )
        db.add(history)

        # Notificar al cliente
        notification = Notification(
            user_id=incident.user_id,
            incident_id=incident.id,
            title="Actualización de servicio",
            message=f"Tu solicitud ha cambiado a estado: {status_label}",
            type=NotificationType.STATUS_UPDATE,
        )
        db.add(notification)
        notify_user_realtime(incident.user_id, {
            "type": "status_update",
            "incident_id": incident.id,
            "status": data.status.value,
            "title": "Actualización de servicio",
            "message": f"Tu solicitud ha cambiado a estado: {status_label}",
        })
        send_push_to_user(
            db, incident.user_id,
            "Actualización de servicio",
            f"Tu solicitud ha cambiado a estado: {status_label}",
            {"incident_id": str(incident.id)},
        )

    if data.final_cost is not None:
        incident.final_cost = data.final_cost
        incident.commission_amount = data.final_cost * 0.10

    if data.estimated_arrival is not None:
        incident.estimated_arrival = data.estimated_arrival

    db.commit()
    db.refresh(incident)
    return incident


@router.post("/{incident_id}/accept", response_model=IncidentResponse)
def accept_incident(
    incident_id: int,
    technician_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo talleres pueden aceptar incidentes")

    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")

    incident = db.query(Incident).filter(
        Incident.id == incident_id, Incident.status == IncidentStatus.PENDING
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado o ya asignado")

    incident.tenant_id = workshop.tenant_id
    incident.workshop_id = workshop.id
    incident.technician_id = technician_id
    incident.status = IncidentStatus.ASSIGNED
    incident.assigned_at = datetime.now(timezone.utc)

    history = StatusHistory(
        incident_id=incident.id,
        status=IncidentStatus.ASSIGNED.value,
        changed_by=current_user.full_name,
        notes=f"Aceptado por taller: {workshop.name}",
    )
    db.add(history)

    notification = Notification(
        user_id=incident.user_id,
        incident_id=incident.id,
        title="Taller asignado",
        message=f"El taller {workshop.name} ha aceptado tu solicitud",
        type=NotificationType.INCIDENT_ASSIGNED,
    )
    db.add(notification)
    notify_user_realtime(incident.user_id, {
        "type": "incident_assigned",
        "incident_id": incident.id,
        "title": "Taller asignado",
        "message": f"El taller {workshop.name} ha aceptado tu solicitud",
    })
    send_push_to_user(
        db, incident.user_id,
        "Taller asignado",
        f"El taller {workshop.name} ha aceptado tu solicitud",
        {"incident_id": str(incident.id)},
    )

    db.commit()
    db.refresh(incident)
    return incident


@router.post("/{incident_id}/reject")
def reject_incident(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.WORKSHOP, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Solo talleres o administradores pueden rechazar incidentes")

    if current_user.role == UserRole.ADMIN:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
    else:
        workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
        incident = db.query(Incident).filter(
            Incident.id == incident_id,
            Incident.workshop_id == workshop.id,
        ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    incident.tenant_id = None
    incident.workshop_id = None
    incident.technician_id = None
    incident.status = IncidentStatus.PENDING
    incident.assigned_at = None
    db.commit()
    return {"message": "Incidente rechazado"}


@router.post("/{incident_id}/process-ai", response_model=IncidentResponse)
async def process_with_ai(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    from app.services.ai_processor import process_incident
    await process_incident(incident_id, db)
    db.refresh(incident)
    return incident
