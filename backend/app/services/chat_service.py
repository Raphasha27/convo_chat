from sqlalchemy.ext.asyncio import AsyncSession
from app.models.chat import Message, ChatMember
from sqlalchemy.future import select

async def save_message(db: AsyncSession, chat_id: int, sender_id: int, content: str, msg_type: str = "text", media_url: str = None):
    new_message = Message(chat_id=chat_id, sender_id=sender_id, content=content, msg_type=msg_type, media_url=media_url)
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    return new_message

async def get_chat_members(db: AsyncSession, chat_id: int):
    result = await db.execute(select(ChatMember.user_id).where(ChatMember.chat_id == chat_id))
    return result.scalars().all()

async def update_message_status(db: AsyncSession, message_id: int, status: str):
    from sqlalchemy import update
    await db.execute(update(Message).where(Message.message_id == message_id).values(status=status))
    await db.commit()

async def mark_chat_as_read(db: AsyncSession, chat_id: int, user_id: int):
    from sqlalchemy import update
    # Mark all messages in this chat NOT from this user as 'read'
    await db.execute(
        update(Message)
        .where(Message.chat_id == chat_id)
        .where(Message.sender_id != user_id)
        .where(Message.status != "read")
        .values(status="read")
    )
    await db.commit()
