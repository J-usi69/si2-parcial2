from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.chat import ChatMessage
from app.models.incident import Incident
from app.models.user import User, UserRole
from app.models.workshop import Workshop
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
from app.services.notification_service import notify_user_realtime
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/chat", tags=["Chat"])


def _verify_access(incident: Incident, user: User, db: Session) -> None:
    """Verify the user is either the incident's client or the assigned workshop."""
    if user.role == UserRole.CLIENT and incident.user_id == user.id:
        return
    if user.role == UserRole.WORKSHOP:
        workshop = db.query(Workshop).filter(Workshop.user_id == user.id).first()
        if workshop and incident.workshop_id == workshop.id:
            return
    if user.role == UserRole.ADMIN:
        return
    raise HTTPException(status_code=403, detail="Sin acceso a este chat")


@router.get("/{incident_id}/messages", response_model=list[ChatMessageResponse])
def get_messages(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    _verify_access(incident, current_user, db)

    return (
        db.query(ChatMessage)
        .filter(ChatMessage.incident_id == incident_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.post("/{incident_id}/messages", response_model=ChatMessageResponse)
def send_message(
    incident_id: int,
    data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    _verify_access(incident, current_user, db)

    msg = ChatMessage(
        incident_id=incident_id,
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        sender_role=current_user.role.value,
        message=data.message.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Notify the other party via WebSocket
    chat_payload = {
        "type": "chat_message",
        "incident_id": incident_id,
        "sender_id": current_user.id,
        "sender_name": current_user.full_name,
        "sender_role": current_user.role.value,
        "message": msg.message,
    }

    if current_user.role == UserRole.CLIENT and incident.workshop_id:
        # Notify workshop owner
        workshop = db.query(Workshop).filter(Workshop.id == incident.workshop_id).first()
        if workshop:
            notify_user_realtime(workshop.user_id, chat_payload)
    elif current_user.role == UserRole.WORKSHOP:
        # Notify client
        notify_user_realtime(incident.user_id, chat_payload)

    return msg
