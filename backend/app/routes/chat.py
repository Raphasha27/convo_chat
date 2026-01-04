from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.chat import Chat, ChatMember, Message
from app.models.user import User
from app.schemas.chat import ChatCreate, ChatOut, MessageOut
from app.websocket.manager import manager
from app.core.security import get_current_user
from typing import List

router = APIRouter()

@router.get("/", response_model=List[ChatOut])
async def get_my_chats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find all chats where user is a member
    stmt = select(Chat).join(ChatMember).where(ChatMember.user_id == current_user.user_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/create", response_model=ChatOut)
async def create_chat(chat_data: ChatCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_chat = Chat(is_group=chat_data.is_group, name=chat_data.name, created_by=current_user.user_id)
    db.add(new_chat)
    await db.commit()
    await db.refresh(new_chat)
    
    # Add creator
    creator_member = ChatMember(chat_id=new_chat.chat_id, user_id=current_user.user_id, role="admin")
    db.add(creator_member)
    
    # Add participants
    for pid in chat_data.participant_ids:
        if pid != current_user.user_id:
            member = ChatMember(chat_id=new_chat.chat_id, user_id=pid, role="member")
            db.add(member)
            
    await db.commit()
    return new_chat

@router.get("/{chat_id}/messages", response_model=List[MessageOut])
async def get_chat_messages(chat_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify membership
    membership = await db.execute(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == current_user.user_id))
    if not membership.scalars().first():
        raise HTTPException(status_code=403, detail="Not a member of this chat")
    
    stmt = select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/{chat_id}")
async def delete_chat(chat_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Only creator can delete chat
    result = await db.execute(select(Chat).where(Chat.chat_id == chat_id, Chat.created_by == current_user.user_id))
    chat = result.scalars().first()
    if not chat:
        raise HTTPException(status_code=403, detail="Only the creator can delete this chat")
    
    await db.delete(chat)
    await db.commit()
    return {"message": "Chat deleted"}

@router.post("/{chat_id}/leave")
async def leave_chat(chat_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == current_user.user_id))
    membership = result.scalars().first()
    if not membership:
        raise HTTPException(status_code=404, detail="Not a member")
    
    await db.delete(membership)
    await db.commit()
    return {"message": "Left chat"}

import json
from app.services import chat_service

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: AsyncSession = Depends(get_db)):
    await manager.connect(websocket, user_id)
    
    # Broadcast Online Status
    await manager.broadcast(json.dumps({
        "type": "status",
        "user_id": user_id,
        "status": "online"
    }))
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                msg_type = message_data.get("type", "text")
                chat_id = message_data.get("chat_id")
                content = message_data.get("content")
                recipient_id = message_data.get("recipient_id") # For direct signaling
                
                if msg_type in ["text", "media"]:
                    if chat_id and content:
                        # Save to DB
                        new_msg = await chat_service.save_message(
                            db, chat_id, user_id, content, 
                            msg_type=msg_type, 
                            media_url=message_data.get("media_url")
                        )
                        
                        # Find all members to broadcast to
                        members = await chat_service.get_chat_members(db, chat_id)
                        
                        # Prepare message for broadcast
                        broadcast_data = json.dumps({
                            "type": msg_type,
                            "message_id": new_msg.message_id,
                            "chat_id": chat_id,
                            "sender_id": user_id,
                            "content": content,
                            "media_url": new_msg.media_url,
                            "status": new_msg.status,
                            "created_at": new_msg.created_at.isoformat()
                        })
                        
                        for member_id in members:
                            await manager.send_personal_message(broadcast_data, member_id)
                
                elif msg_type == "read":
                    if chat_id:
                        await chat_service.mark_chat_as_read(db, chat_id, user_id)
                        members = await chat_service.get_chat_members(db, chat_id)
                        read_payload = json.dumps({
                            "type": "read",
                            "chat_id": chat_id,
                            "user_id": user_id
                        })
                        for member_id in members:
                            await manager.send_personal_message(read_payload, member_id)

                elif msg_type == "typing":
                    if chat_id:
                        members = await chat_service.get_chat_members(db, chat_id)
                        typing_payload = json.dumps({
                            "type": "typing",
                            "chat_id": chat_id,
                            "user_id": user_id,
                            "is_typing": message_data.get("is_typing", True)
                        })
                        for member_id in members:
                            if member_id != user_id: # Don't send to self
                                await manager.send_personal_message(typing_payload, member_id)

                elif msg_type in ["call-offer", "call-answer", "ice-candidate", "call-reject"]:
                    # Signaling messages usually go to a specific recipient or chat members
                    if recipient_id:
                        signaling_payload = json.dumps({
                            "type": msg_type,
                            "sender_id": user_id,
                            "data": message_data.get("data") # SDP or Candidate
                        })
                        await manager.send_personal_message(signaling_payload, recipient_id)
            except json.JSONDecodeError:
                # Handle plain text for backward compatibility / testing
                await manager.send_personal_message(f"Echo: {data}", user_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        # Broadcast Offline Status
        await manager.broadcast(json.dumps({
            "type": "status",
            "user_id": user_id,
            "status": "offline"
        }))
