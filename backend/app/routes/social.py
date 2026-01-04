from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from app.core.database import get_db
from app.models.user import User, Friendship
from app.schemas.user import UserOut
from app.core.security import get_current_user
from typing import List

router = APIRouter()

@router.post("/add")
async def add_friend(friend_email: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find friend by email
    result = await db.execute(select(User).where(User.email == friend_email))
    friend = result.scalars().first()
    
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    
    if friend.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    # Check if already friends
    result = await db.execute(select(Friendship).where(
        or_(
            (Friendship.user_id == current_user.user_id) & (Friendship.friend_id == friend.user_id),
            (Friendship.user_id == friend.user_id) & (Friendship.friend_id == current_user.user_id)
        )
    ))
    if result.scalars().first():
        return {"message": "Already connected"}

    # Create friendship
    new_friendship = Friendship(
        user_id=current_user.user_id,
        friend_id=friend.user_id,
        status="accepted"
    )
    db.add(new_friendship)
    await db.commit()
    
    return {"message": f"Connected with {friend.username}"}

@router.get("/list", response_model=List[UserOut])
async def get_contacts(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find all users who are friends
    result = await db.execute(select(Friendship).where(
        or_(
            Friendship.user_id == current_user.user_id,
            Friendship.friend_id == current_user.user_id
        )
    ))
    friendships = result.scalars().all()
    
    friend_ids = []
    for f in friendships:
        if f.user_id == current_user.user_id:
            friend_ids.append(f.friend_id)
        else:
            friend_ids.append(f.user_id)
            
    if not friend_ids:
        return []
        
    result = await db.execute(select(User).where(User.user_id.in_(friend_ids)))
    return result.scalars().all()

@router.get("/search", response_model=List[UserOut])
async def search_users(query: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(User).where(
        (User.user_id != current_user.user_id) &
        (or_(
            User.email.ilike(f"%{query}%"),
            User.username.ilike(f"%{query}%")
        ))
    ))
    return result.scalars().all()
