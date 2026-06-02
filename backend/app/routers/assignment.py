from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.incident import Incident
from app.models.invitation import InvitationStatus, WorkshopInvitation
from app.models.user import User, UserRole
from app.schemas.invitation import WorkshopInvitationResponse, serialize_invitation
from app.services.assignment_engine import find_best_workshops
from app.services.notification_service import expire_stale_invitations
from app.services.reputation_service import apply_accept, apply_reject
from app.utils.security import get_current_user
from app.utils.tenancy import get_user_workshop

router = APIRouter(prefix="/api/assignment", tags=["Asignacion"])


@router.get("/{incident_id}/candidates")
def get_candidates(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    candidates = find_best_workshops(incident, db)
    return {"incident_id": incident_id, "candidates": candidates}


# --- Invitaciones (taller responde si/no) ---

def _workshop_for(current_user: User, db: Session):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo talleres pueden gestionar invitaciones")
    workshop = get_user_workshop(db, current_user)
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")
    return workshop


@router.get("/invitations/mine", response_model=list[WorkshopInvitationResponse])
def list_my_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workshop = _workshop_for(current_user, db)
    # Primero vence las invitaciones expiradas (aplica penalizacion).
    expire_stale_invitations(db)
    invitations = (
        db.query(WorkshopInvitation)
        .filter(WorkshopInvitation.workshop_id == workshop.id)
        .order_by(WorkshopInvitation.sent_at.desc())
        .all()
    )
    return [serialize_invitation(inv) for inv in invitations]


def _respond(invitation_id: int, accept: bool, current_user: User, db: Session) -> WorkshopInvitation:
    workshop = _workshop_for(current_user, db)
    invitation = db.query(WorkshopInvitation).filter(
        WorkshopInvitation.id == invitation_id,
        WorkshopInvitation.workshop_id == workshop.id,
    ).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitacion no encontrada")
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="La invitacion ya fue respondida o expiro")

    now = datetime.now(timezone.utc)
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        # Venció: marcar expirada y penalizar.
        from app.services.reputation_service import apply_ignore
        invitation.status = InvitationStatus.EXPIRED
        apply_ignore(workshop)
        db.commit()
        raise HTTPException(status_code=400, detail="La invitacion ya expiro")

    sent_at = invitation.sent_at
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    invitation.responded_at = now
    invitation.response_time_seconds = int((now - sent_at).total_seconds())

    if accept:
        invitation.status = InvitationStatus.ACCEPTED
        apply_accept(workshop, invitation.response_time_seconds)
    else:
        invitation.status = InvitationStatus.REJECTED
        apply_reject(workshop)
    db.commit()
    db.refresh(invitation)
    return invitation


@router.post("/invitations/{invitation_id}/accept", response_model=WorkshopInvitationResponse)
def accept_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """El taller acepta ('yo atiendo'). Luego puede enviar su oferta al cliente."""
    invitation = _respond(invitation_id, True, current_user, db)
    return serialize_invitation(invitation)


@router.post("/invitations/{invitation_id}/reject", response_model=WorkshopInvitationResponse)
def reject_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitation = _respond(invitation_id, False, current_user, db)
    return serialize_invitation(invitation)
