from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.incident import Incident, IncidentStatus
from app.models.review import Review
from app.models.user import User, UserRole
from app.models.workshop import Workshop
from app.schemas.review import ReviewCreate, ReviewResponse
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Client submits a review for a completed incident."""
    incident = db.query(Incident).filter(
        Incident.id == data.incident_id,
        Incident.user_id == current_user.id,
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    if incident.status != IncidentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Solo puedes calificar incidentes completados")

    if not incident.workshop_id:
        raise HTTPException(status_code=400, detail="El incidente no tiene taller asignado")

    existing = db.query(Review).filter(Review.incident_id == data.incident_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya calificaste este incidente")

    review = Review(
        incident_id=data.incident_id,
        user_id=current_user.id,
        workshop_id=incident.workshop_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)

    # Update workshop average rating
    workshop = db.query(Workshop).filter(Workshop.id == incident.workshop_id).first()
    if workshop:
        total = workshop.total_ratings
        old_avg = workshop.rating
        new_total = total + 1
        workshop.rating = round(((old_avg * total) + data.rating) / new_total, 2)
        workshop.total_ratings = new_total

    db.commit()
    db.refresh(review)

    return ReviewResponse(
        id=review.id,
        incident_id=review.incident_id,
        user_id=review.user_id,
        workshop_id=review.workshop_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        user_name=current_user.full_name,
    )


@router.get("/incident/{incident_id}", response_model=ReviewResponse | None)
def get_review_for_incident(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get review for a specific incident (if exists)."""
    review = db.query(Review).filter(Review.incident_id == incident_id).first()
    if not review:
        return None
    return ReviewResponse(
        id=review.id,
        incident_id=review.incident_id,
        user_id=review.user_id,
        workshop_id=review.workshop_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        user_name=review.user.full_name if review.user else None,
    )


@router.get("/workshop/{workshop_id}", response_model=list[ReviewResponse])
def get_workshop_reviews(
    workshop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all reviews for a workshop."""
    reviews = db.query(Review).filter(Review.workshop_id == workshop_id).order_by(Review.created_at.desc()).all()
    return [
        ReviewResponse(
            id=r.id,
            incident_id=r.incident_id,
            user_id=r.user_id,
            workshop_id=r.workshop_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
            user_name=r.user.full_name if r.user else None,
        )
        for r in reviews
    ]


@router.get("/my-reviews", response_model=list[ReviewResponse])
def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get reviews for the current workshop."""
    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tienes un taller registrado")

    reviews = db.query(Review).filter(Review.workshop_id == workshop.id).order_by(Review.created_at.desc()).all()
    return [
        ReviewResponse(
            id=r.id,
            incident_id=r.incident_id,
            user_id=r.user_id,
            workshop_id=r.workshop_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
            user_name=r.user.full_name if r.user else None,
        )
        for r in reviews
    ]
