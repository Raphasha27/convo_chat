from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.core.security import get_current_user
from typing import List

router = APIRouter()

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserOut)
async def update_profile(user_update: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_update.username is not None:
        current_user.username = user_update.username
    if user_update.phone_number is not None:
        current_user.phone_number = user_update.phone_number
    if user_update.status_message is not None:
        current_user.status_message = user_update.status_message
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.get("/", response_model=List[UserOut])
async def get_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(User).where(User.user_id != current_user.user_id))
    return result.scalars().all()
