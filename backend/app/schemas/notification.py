from datetime import datetime

from pydantic import BaseModel

from app.models.notification import NotificationType


class AdminPushRequest(BaseModel):
    title: str
    message: str
    target_roles: list[str] = ["client", "technician"]
    user_ids: list[int] | None = None


class AdminPushResponse(BaseModel):
    targeted: int
    in_app_created: int
    push_sent: int
    without_push_token: int


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    incident_id: int | None
    title: str
    message: str
    type: NotificationType
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
