import asyncio
import math

from app.services.websocket_manager import manager


def notify_user_realtime(user_id: int, notification_data: dict):
    """Send a real-time notification via WebSocket.
    Works from both sync and async contexts."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.send_to_user(user_id, notification_data))
    except RuntimeError:
        try:
            import anyio

            anyio.from_thread.run(manager.send_to_user, user_id, notification_data)
        except RuntimeError:
            # Called outside FastAPI's event loop/thread context.
            pass


def send_push_to_user(db, user_id: int, title: str, body: str, data: dict | None = None):
    """Send a Firebase push notification to a user if they have a firebase_token."""
    from app.models.user import User
    from app.services.push_service import send_push_notification

    user = db.query(User).filter(User.id == user_id).first()
    if user and user.firebase_token:
        send_push_notification(user.firebase_token, title, body, data)


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def invite_workshops_for_incident(db, incident, max_invites: int = 5, radius_km: float = 30.0) -> int:
    """Invita (no a todos) a los talleres mas adecuados para una emergencia.

    Criterios: especialidad compatible con la categoria, cercania (radio) y
    reputacion. Crea una WorkshopInvitation con ventana de respuesta; el taller
    debe responder si/no. Tambien notifica via WebSocket + push.
    """
    from datetime import datetime, timedelta, timezone

    from app.models.incident import IncidentCategory
    from app.models.invitation import InvitationStatus, WorkshopInvitation
    from app.models.notification import Notification, NotificationType
    from app.models.workshop import Technician, Workshop
    from app.services.reputation_service import (
        INVITATION_TIMEOUT_SECONDS,
        reputation_factor,
        register_invitation_sent,
    )

    category = incident.category.value if incident.category else IncidentCategory.UNCERTAIN.value
    workshops = db.query(Workshop).filter(Workshop.is_available == True).all()  # noqa: E712

    scored = []
    for workshop in workshops:
        services = {s.strip() for s in (workshop.services or "").split(",") if s.strip()}
        is_match = category == IncidentCategory.UNCERTAIN.value or category in services or "other" in services
        if not is_match:
            continue
        # Debe tener al menos un tecnico disponible.
        has_tech = db.query(Technician).filter(
            Technician.workshop_id == workshop.id, Technician.is_available == True  # noqa: E712
        ).first()
        if not has_tech:
            continue
        distance = _distance_km(incident.latitude, incident.longitude, workshop.latitude, workshop.longitude)
        if distance > radius_km:
            continue
        distance_factor = max(0.0, 1 - distance / radius_km)
        rank = distance_factor * 0.6 + reputation_factor(workshop) * 0.4
        scored.append((workshop, distance, rank))

    # Mejor ranking primero; invitar solo a los top N.
    scored.sort(key=lambda item: item[2], reverse=True)
    selected = scored[:max_invites]

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=INVITATION_TIMEOUT_SECONDS)
    deliveries = []
    invited = 0

    for workshop, distance, _rank in selected:
        existing = db.query(WorkshopInvitation).filter(
            WorkshopInvitation.incident_id == incident.id,
            WorkshopInvitation.workshop_id == workshop.id,
        ).first()
        if existing:
            continue
        db.add(WorkshopInvitation(
            incident_id=incident.id,
            workshop_id=workshop.id,
            tenant_id=workshop.tenant_id,
            status=InvitationStatus.PENDING,
            distance_km=round(distance, 2),
            sent_at=now,
            expires_at=expires_at,
        ))
        register_invitation_sent(workshop)

        title = "Invitacion a atender emergencia"
        message = f"Solicitud #{incident.id}: {category}, a {distance:.1f} km. Responde si atiendes antes de que expire."
        db.add(Notification(
            user_id=workshop.user_id,
            incident_id=incident.id,
            title=title,
            message=message,
            type=NotificationType.NEW_INCIDENT,
        ))
        deliveries.append((workshop.user_id, title, message, distance))
        invited += 1

    if deliveries:
        db.commit()

    for user_id, title, message, distance in deliveries:
        notify_user_realtime(user_id, {
            "type": "invitation",
            "incident_id": incident.id,
            "category": category,
            "distance_km": round(distance, 2),
            "expires_at": expires_at.isoformat(),
            "title": title,
            "message": message,
        })
        send_push_to_user(db, user_id, title, message, {
            "type": "invitation",
            "incident_id": str(incident.id),
            "category": category,
        })

    return invited


def expire_stale_invitations(db) -> int:
    """Marca EXPIRED las invitaciones PENDING vencidas y penaliza la reputacion."""
    from datetime import datetime, timezone

    from app.models.invitation import InvitationStatus, WorkshopInvitation
    from app.models.workshop import Workshop
    from app.services.reputation_service import apply_ignore

    now = datetime.now(timezone.utc)
    stale = db.query(WorkshopInvitation).filter(
        WorkshopInvitation.status == InvitationStatus.PENDING,
        WorkshopInvitation.expires_at < now,
    ).all()
    for inv in stale:
        inv.status = InvitationStatus.EXPIRED
        workshop = db.query(Workshop).filter(Workshop.id == inv.workshop_id).first()
        if workshop:
            apply_ignore(workshop)
    if stale:
        db.commit()
    return len(stale)


def notify_compatible_workshops(db, incident, radius_km: float = 30.0, fallback_limit: int = 5) -> int:
    """Notify available workshops that can attend an incident, without duplicates."""
    from app.models.incident import IncidentCategory
    from app.models.notification import Notification, NotificationType
    from app.models.workshop import Workshop

    category = incident.category.value if incident.category else IncidentCategory.UNCERTAIN.value
    workshops = db.query(Workshop).filter(Workshop.is_available == True).all()  # noqa: E712
    candidates = []

    for workshop in workshops:
        services = {service.strip() for service in (workshop.services or "").split(",") if service.strip()}
        is_match = category == IncidentCategory.UNCERTAIN.value or category in services or "other" in services
        if not is_match:
            continue
        distance = _distance_km(incident.latitude, incident.longitude, workshop.latitude, workshop.longitude)
        candidates.append((workshop, distance))

    candidates.sort(key=lambda item: item[1])
    nearby_candidates = [item for item in candidates if item[1] <= radius_km]
    selected_candidates = nearby_candidates or candidates[:fallback_limit]
    deliveries = []
    notified = 0

    for workshop, distance in selected_candidates:
        exists = db.query(Notification).filter(
            Notification.user_id == workshop.user_id,
            Notification.incident_id == incident.id,
            Notification.type == NotificationType.NEW_INCIDENT,
        ).first()
        if exists:
            continue

        title = "Nueva emergencia cercana"
        message = f"Solicitud #{incident.id}: {category}, a {distance:.1f} km. Revisa el caso y envia una oferta al cliente."
        db.add(Notification(
            user_id=workshop.user_id,
            incident_id=incident.id,
            title=title,
            message=message,
            type=NotificationType.NEW_INCIDENT,
        ))
        deliveries.append((workshop.user_id, title, message, distance))
        notified += 1

    if deliveries:
        db.commit()

    for user_id, title, message, distance in deliveries:
        notify_user_realtime(user_id, {
            "type": "new_incident",
            "incident_id": incident.id,
            "category": category,
            "distance_km": round(distance, 2),
            "title": title,
            "message": message,
        })
        send_push_to_user(
            db,
            user_id,
            title,
            message,
            {
                "type": "new_incident",
                "incident_id": str(incident.id),
                "category": category,
                "distance_km": f"{distance:.2f}",
            },
        )

    return notified
