from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ChatCreate(BaseModel):
    is_group: bool = False
    name: Optional[str] = None
    participant_ids: List[int]

class MessageCreate(BaseModel):
    chat_id: int
    content: str
    msg_type: str = "text"

class MessageOut(BaseModel):
    message_id: int
    chat_id: int
    sender_id: int
    content: Optional[str] = None
    media_url: Optional[str] = None
    msg_type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatMemberOut(BaseModel):
    user_id: int
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True

class ChatOut(BaseModel):
    chat_id: int
    is_group: bool
    name: Optional[str]
    created_by: int
    created_at: datetime
    # members: List[ChatMemberOut] # We can add this later if we update routes to use selectinload

    class Config:
        from_attributes = True
