from datetime import datetime

from pydantic import BaseModel

from app.models.payment import PaymentStatus


class PaymentCreate(BaseModel):
    incident_id: int
    amount: float
    payment_method: str = "card"
    card_id: int | None = None


class PaymentCardCreate(BaseModel):
    holder_name: str
    card_number: str
    exp_month: int
    exp_year: int
    cvv: str
    brand: str = "card"


class PaymentCardResponse(BaseModel):
    id: int
    user_id: int
    holder_name: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentResponse(BaseModel):
    id: int
    incident_id: int
    amount: float
    commission_amount: float
    payment_method: str
    status: PaymentStatus
    transaction_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
