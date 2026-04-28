from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.schemas.notification import AdminPushRequest, AdminPushResponse, NotificationResponse
from app.services.push_service import send_push_notification
from app.services.notification_service import notify_user_realtime
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notificaciones"])


@router.post("/admin/push", response_model=AdminPushResponse, status_code=status.HTTP_201_CREATED)
def send_admin_push(
    data: AdminPushRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar notificaciones")

    allowed_roles = {UserRole.CLIENT, UserRole.TECHNICIAN}
    requested_roles: set[UserRole] = set()
    for role in data.target_roles:
        try:
            user_role = UserRole(role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Rol invalido: {role}")
        if user_role not in allowed_roles:
            raise HTTPException(status_code=400, detail="Solo se puede notificar a clientes o mecanicos")
        requested_roles.add(user_role)

    if not requested_roles:
        raise HTTPException(status_code=400, detail="Selecciona al menos un destinatario")
    if not data.title.strip() or not data.message.strip():
        raise HTTPException(status_code=400, detail="Titulo y mensaje son obligatorios")

    query = db.query(User).filter(User.role.in_(requested_roles), User.is_active == True)  # noqa: E712
    if data.user_ids:
        query = query.filter(User.id.in_(data.user_ids))
    users = query.order_by(User.full_name.asc()).all()

    push_sent = 0
    without_push_token = 0
    for user in users:
        notification = Notification(
            user_id=user.id,
            incident_id=None,
            title=data.title.strip(),
            message=data.message.strip(),
            type=NotificationType.STATUS_UPDATE,
        )
        db.add(notification)

        notify_user_realtime(user.id, {
            "type": "platform_push",
            "title": data.title.strip(),
            "message": data.message.strip(),
            "target_role": user.role.value,
        })

        if user.firebase_token:
            sent = send_push_notification(
                user.firebase_token,
                data.title.strip(),
                data.message.strip(),
                {"type": "platform_push", "target_role": user.role.value},
            )
            push_sent += 1 if sent else 0
        else:
            without_push_token += 1

    db.commit()
    return AdminPushResponse(
        targeted=len(users),
        in_app_created=len(users),
        push_sent=push_sent,
        without_push_token=without_push_token,
    )


@router.get("/", response_model=list[NotificationResponse])
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/unread-count")
def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.put("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notification:
        notification.is_read = True
        db.commit()
    return {"message": "Notificacion marcada como leida"}


@router.put("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "Todas las notificaciones marcadas como leidas"}
