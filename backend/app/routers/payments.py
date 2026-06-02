import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.incident import Incident, IncidentStatus
from app.models.notification import Notification, NotificationType
from app.models.payment import Payment, PaymentCard, PaymentStatus
from app.models.user import User, UserRole
from app.schemas.payment import AdminPaymentResponse, AdminPaymentSummary, PaymentCardCreate, PaymentCardResponse, PaymentCreate, PaymentResponse
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/payments", tags=["Pagos"])


def _admin_payment_response(payment: Payment) -> AdminPaymentResponse:
    incident = payment.incident
    return AdminPaymentResponse(
        id=payment.id,
        incident_id=payment.incident_id,
        amount=payment.amount,
        commission_amount=payment.commission_amount,
        payment_method=payment.payment_method,
        status=payment.status,
        transaction_id=payment.transaction_id,
        created_at=payment.created_at,
        client_name=incident.user.full_name if incident and incident.user else None,
        workshop_name=incident.workshop.name if incident and incident.workshop else None,
        incident_status=incident.status.value if incident else None,
    )


@router.get("/admin", response_model=list[AdminPaymentResponse])
def list_admin_payments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver pagos")
    payments = db.query(Payment).order_by(Payment.created_at.desc()).all()
    return [_admin_payment_response(payment) for payment in payments]


@router.get("/admin/summary", response_model=AdminPaymentSummary)
def admin_payment_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver pagos")
    payments = db.query(Payment).all()
    return AdminPaymentSummary(
        total_payments=len(payments),
        total_amount=round(sum(payment.amount for payment in payments), 2),
        total_commission=round(sum(payment.commission_amount for payment in payments), 2),
        card_amount=round(sum(payment.amount for payment in payments if payment.payment_method == "card"), 2),
        cash_amount=round(sum(payment.amount for payment in payments if payment.payment_method == "cash"), 2),
    )


@router.get("/cards", response_model=list[PaymentCardResponse])
def list_cards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Solo clientes pueden gestionar tarjetas")
    return db.query(PaymentCard).filter(PaymentCard.user_id == current_user.id).order_by(PaymentCard.created_at.desc()).all()


@router.post("/cards", response_model=PaymentCardResponse, status_code=status.HTTP_201_CREATED)
def create_card(
    data: PaymentCardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Solo clientes pueden gestionar tarjetas")
    digits = "".join(ch for ch in data.card_number if ch.isdigit())
    cvv_digits = "".join(ch for ch in data.cvv if ch.isdigit())
    if len(digits) != 16:
        raise HTTPException(status_code=400, detail="El numero de tarjeta debe tener 16 digitos")
    if data.exp_month < 1 or data.exp_month > 12:
        raise HTTPException(status_code=400, detail="Mes de vencimiento invalido")
    now = datetime.now()
    if data.exp_year < now.year or (data.exp_year == now.year and data.exp_month < now.month):
        raise HTTPException(status_code=400, detail="Fecha de vencimiento invalida")
    if len(cvv_digits) != 3:
        raise HTTPException(status_code=400, detail="El CVV debe tener 3 digitos")
    has_cards = db.query(PaymentCard).filter(PaymentCard.user_id == current_user.id).count() > 0
    card = PaymentCard(
        user_id=current_user.id,
        holder_name=data.holder_name,
        brand=data.brand,
        last4=digits[-4:],
        exp_month=data.exp_month,
        exp_year=data.exp_year,
        is_default=not has_cards,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.put("/cards/{card_id}/default", response_model=PaymentCardResponse)
def set_default_card(
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Solo clientes pueden gestionar tarjetas")
    card = db.query(PaymentCard).filter(PaymentCard.id == card_id, PaymentCard.user_id == current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    db.query(PaymentCard).filter(PaymentCard.user_id == current_user.id).update({"is_default": False})
    card.is_default = True
    db.commit()
    db.refresh(card)
    return card


@router.delete("/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Solo clientes pueden gestionar tarjetas")
    card = db.query(PaymentCard).filter(PaymentCard.id == card_id, PaymentCard.user_id == current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    was_default = card.is_default
    db.delete(card)
    db.flush()
    if was_default:
        next_card = db.query(PaymentCard).filter(PaymentCard.user_id == current_user.id).order_by(PaymentCard.created_at.desc()).first()
        if next_card:
            next_card.is_default = True
    db.commit()


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(
        Incident.id == data.incident_id, Incident.user_id == current_user.id
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")

    if data.payment_method not in {"card", "cash"}:
        raise HTTPException(status_code=400, detail="Metodo de pago invalido")

    if incident.status not in {IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS}:
        raise HTTPException(status_code=400, detail="Solo puedes pagar un servicio asignado o en atencion")

    if incident.final_cost is None:
        raise HTTPException(status_code=400, detail="El servicio no tiene una oferta aceptada")

    expected_amount = round(float(incident.final_cost), 2)
    requested_amount = round(float(data.amount), 2)
    if requested_amount != expected_amount:
        raise HTTPException(status_code=400, detail="El monto debe coincidir con la oferta aceptada")

    if data.payment_method == "card":
        card_query = db.query(PaymentCard).filter(PaymentCard.user_id == current_user.id)
        if data.card_id:
            card_query = card_query.filter(PaymentCard.id == data.card_id)
        else:
            card_query = card_query.filter(PaymentCard.is_default == True)  # noqa: E712
        if not card_query.first():
            raise HTTPException(status_code=400, detail="Agrega una tarjeta para pagar con tarjeta")

    existing = db.query(Payment).filter(Payment.incident_id == data.incident_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un pago para este incidente")

    commission = expected_amount * 0.10
    payment = Payment(
        incident_id=data.incident_id,
        amount=expected_amount,
        commission_amount=commission,
        payment_method=data.payment_method,
        status=PaymentStatus.COMPLETED,
        transaction_id=f"sim-{uuid.uuid4().hex[:12]}",
    )
    db.add(payment)

    incident.commission_amount = commission
    incident.status = IncidentStatus.COMPLETED
    incident.completed_at = datetime.now(timezone.utc)

    notification = Notification(
        user_id=current_user.id,
        incident_id=incident.id,
        title="Pago realizado",
        message=f"Pago de Bs. {expected_amount:.2f} registrado por {data.payment_method}",
        type=NotificationType.PAYMENT,
    )
    db.add(notification)

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/my-payments", response_model=list[PaymentResponse])
def list_my_payments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incidents = db.query(Incident).filter(Incident.user_id == current_user.id).all()
    incident_ids = [i.id for i in incidents]
    return db.query(Payment).filter(Payment.incident_id.in_(incident_ids)).all()
