from datetime import datetime

from pydantic import BaseModel


class ChatMessageCreate(BaseModel):
    message: str


class ChatMessageResponse(BaseModel):
    id: int
    incident_id: int
    sender_id: int
    sender_name: str
    sender_role: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}
