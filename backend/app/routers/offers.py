import math

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.incident import Incident, IncidentStatus
from app.models.notification import Notification, NotificationType
from app.models.offer import OfferStatus, ServiceOffer
from app.models.status_history import StatusHistory
from app.models.user import User, UserRole
from app.models.workshop import Technician, Workshop
from app.schemas.offer import OfferAcceptRequest, ServiceOfferCreate, ServiceOfferResponse
from app.services.notification_service import notify_user_realtime, send_push_to_user
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/offers", tags=["Ofertas"])


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _score_offer(cost: float, distance_km: float, rating: float, eta: int, min_cost: float | None = None) -> float:
    cost_ref = max(min_cost or cost, 1)
    cost_score = max(0, min(1, cost_ref / max(cost, 1)))
    distance_score = max(0, min(1, 1 - distance_km / 20))
    rating_score = max(0, min(1, rating / 5))
    eta_score = max(0, min(1, 1 - eta / 90))
    return round((rating_score * 0.35 + distance_score * 0.30 + cost_score * 0.25 + eta_score * 0.10) * 100, 2)


def _reason(offer: ServiceOffer, workshop: Workshop) -> str:
    parts = []
    if offer.distance_km <= 4:
        parts.append("esta muy cerca")
    if workshop.rating >= 4.6:
        parts.append(f"tiene alta calificacion ({workshop.rating:.1f})")
    if offer.cost <= 120:
        parts.append("ofrece un costo conveniente")
    if offer.estimated_arrival <= 20:
        parts.append("puede llegar rapido")
    if not parts:
        parts.append("equilibra precio, distancia y reputacion")
    return "Recomendado porque " + ", ".join(parts) + "."


def _serialize_offer(offer: ServiceOffer, best_id: int | None = None) -> ServiceOfferResponse:
    return ServiceOfferResponse(
        id=offer.id,
        incident_id=offer.incident_id,
        workshop_id=offer.workshop_id,
        technician_id=offer.technician_id,
        cost=offer.cost,
        estimated_arrival=offer.estimated_arrival,
        distance_km=offer.distance_km,
        score=offer.score,
        recommendation_reason=offer.recommendation_reason,
        message=offer.message,
        status=offer.status,
        created_at=offer.created_at,
        workshop_name=offer.workshop.name if offer.workshop else None,
        workshop_rating=offer.workshop.rating if offer.workshop else None,
        workshop_total_ratings=offer.workshop.total_ratings if offer.workshop else None,
        technician_name=offer.technician.name if offer.technician else None,
        is_recommended=offer.id == best_id,
    )


def _ensure_demo_offers(db: Session, incident: Incident) -> None:
    existing = db.query(ServiceOffer).filter(ServiceOffer.incident_id == incident.id).count()
    if existing > 0 or incident.status != IncidentStatus.PENDING:
        return

    workshops = db.query(Workshop).filter(Workshop.is_available == True).all()  # noqa: E712
    if not workshops:
        return

    base_by_category = {
        "battery": 90,
        "tire": 80,
        "crash": 180,
        "engine": 150,
        "keys": 70,
        "other": 120,
        "uncertain": 120,
    }
    base_cost = base_by_category.get(incident.category.value, 120)
    draft: list[tuple[Workshop, Technician | None, float, int, float]] = []
    for index, workshop in enumerate(workshops):
        distance = round(_distance_km(incident.latitude, incident.longitude, workshop.latitude, workshop.longitude), 2)
        eta = max(10, min(75, int(distance * 4) + 8 + index * 3))
        cost = round(base_cost + distance * 6 + max(0, 5 - workshop.rating) * 18 + index * 7, 2)
        technician = next((tech for tech in workshop.technicians if tech.is_available), None)
        draft.append((workshop, technician, cost, eta, distance))

    min_cost = min(item[2] for item in draft)
    for workshop, technician, cost, eta, distance in draft:
        offer = ServiceOffer(
            incident_id=incident.id,
            workshop_id=workshop.id,
            technician_id=technician.id if technician else None,
            cost=cost,
            estimated_arrival=eta,
            distance_km=distance,
            message="Oferta demo generada para comparar talleres disponibles.",
            status=OfferStatus.PENDING,
        )
        offer.score = _score_offer(cost, distance, workshop.rating, eta, min_cost)
        offer.recommendation_reason = _reason(offer, workshop)
        db.add(offer)
    db.commit()


def _get_client_incident(db: Session, incident_id: int, current_user: User) -> Incident:
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.user_id == current_user.id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    return incident


@router.get("/incidents/{incident_id}", response_model=list[ServiceOfferResponse])
def list_incident_offers(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Solo clientes pueden comparar ofertas")
    incident = _get_client_incident(db, incident_id, current_user)
    _ensure_demo_offers(db, incident)
    offers = db.query(ServiceOffer).filter(ServiceOffer.incident_id == incident.id).order_by(ServiceOffer.score.desc()).all()
    best_id = offers[0].id if offers else None
    return [_serialize_offer(offer, best_id) for offer in offers]


@router.get("/incidents/{incident_id}/mine", response_model=ServiceOfferResponse | None)
def get_my_workshop_offer(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo talleres pueden consultar su oferta")
    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")
    offer = db.query(ServiceOffer).filter(
        ServiceOffer.incident_id == incident_id,
        ServiceOffer.workshop_id == workshop.id,
    ).first()
    if not offer:
        return None
    return _serialize_offer(offer)


@router.post("/incidents/{incident_id}", response_model=ServiceOfferResponse, status_code=status.HTTP_201_CREATED)
def create_workshop_offer(
    incident_id: int,
    data: ServiceOfferCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo talleres pueden enviar ofertas")
    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.status == IncidentStatus.PENDING).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado o ya asignado")
    existing = db.query(ServiceOffer).filter(ServiceOffer.incident_id == incident.id, ServiceOffer.workshop_id == workshop.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya enviaste una oferta para este incidente")

    technician = None
    if data.technician_id:
        technician = db.query(Technician).filter(Technician.id == data.technician_id, Technician.workshop_id == workshop.id).first()
        if not technician:
            raise HTTPException(status_code=404, detail="Tecnico no encontrado")
    distance = round(_distance_km(incident.latitude, incident.longitude, workshop.latitude, workshop.longitude), 2)
    offer = ServiceOffer(
        incident_id=incident.id,
        workshop_id=workshop.id,
        technician_id=technician.id if technician else None,
        cost=data.cost,
        estimated_arrival=data.estimated_arrival,
        distance_km=distance,
        score=_score_offer(data.cost, distance, workshop.rating, data.estimated_arrival, data.cost),
        message=data.message,
        status=OfferStatus.PENDING,
    )
    offer.recommendation_reason = _reason(offer, workshop)
    db.add(offer)
    db.add(Notification(
        user_id=incident.user_id,
        incident_id=incident.id,
        title="Nueva oferta de taller",
        message=f"{workshop.name} envio una oferta por Bs. {data.cost:.2f}",
        type=NotificationType.INCIDENT_ASSIGNED,
    ))
    db.commit()
    db.refresh(offer)
    return _serialize_offer(offer, offer.id)


def _accept_offer(db: Session, offer: ServiceOffer, current_user: User) -> ServiceOffer:
    incident = db.query(Incident).filter(Incident.id == offer.incident_id, Incident.user_id == current_user.id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    if incident.status != IncidentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Este incidente ya tiene un taller asignado")

    offer.status = OfferStatus.ACCEPTED
    incident.workshop_id = offer.workshop_id
    incident.technician_id = offer.technician_id
    incident.status = IncidentStatus.ASSIGNED
    incident.final_cost = offer.cost
    incident.commission_amount = offer.cost * 0.10
    incident.estimated_arrival = offer.estimated_arrival

    db.query(ServiceOffer).filter(ServiceOffer.incident_id == incident.id, ServiceOffer.id != offer.id).update({"status": OfferStatus.REJECTED})
    db.add(StatusHistory(
        incident_id=incident.id,
        status=IncidentStatus.ASSIGNED.value,
        changed_by=current_user.full_name,
        notes=f"Oferta aceptada: {offer.workshop.name if offer.workshop else 'Taller'}",
    ))
    db.add(Notification(
        user_id=incident.user_id,
        incident_id=incident.id,
        title="Oferta aceptada",
        message=f"Seleccionaste a {offer.workshop.name if offer.workshop else 'un taller'} por Bs. {offer.cost:.2f}",
        type=NotificationType.INCIDENT_ASSIGNED,
    ))
    notify_user_realtime(incident.user_id, {
        "type": "offer_accepted",
        "incident_id": incident.id,
        "title": "Oferta aceptada",
        "message": f"Taller asignado: {offer.workshop.name if offer.workshop else 'Taller'}",
    })
    send_push_to_user(
        db,
        incident.user_id,
        "Oferta aceptada",
        f"Taller asignado: {offer.workshop.name if offer.workshop else 'Taller'}",
        {"incident_id": str(incident.id)},
    )
    db.commit()
    db.refresh(offer)
    return offer


@router.post("/{offer_id}/accept", response_model=ServiceOfferResponse)
def accept_offer(
    offer_id: int,
    _: OfferAcceptRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Solo clientes pueden aceptar ofertas")
    offer = db.query(ServiceOffer).filter(ServiceOffer.id == offer_id, ServiceOffer.status == OfferStatus.PENDING).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    accepted = _accept_offer(db, offer, current_user)
    return _serialize_offer(accepted, accepted.id)


@router.post("/incidents/{incident_id}/auto-accept", response_model=ServiceOfferResponse)
def auto_accept_best_offer(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Solo clientes pueden aceptar ofertas")
    incident = _get_client_incident(db, incident_id, current_user)
    _ensure_demo_offers(db, incident)
    offer = db.query(ServiceOffer).filter(ServiceOffer.incident_id == incident.id, ServiceOffer.status == OfferStatus.PENDING).order_by(ServiceOffer.score.desc()).first()
    if not offer:
        raise HTTPException(status_code=404, detail="No hay ofertas disponibles")
    accepted = _accept_offer(db, offer, current_user)
    return _serialize_offer(accepted, accepted.id)
