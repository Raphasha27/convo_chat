from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.core.security import get_password_hash, verify_password, create_access_token
from datetime import timedelta
from app.core.config import settings
import random

router = APIRouter()

@router.post("/register", response_model=UserOut)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    existing_user = result.scalars().first()
    if existing_user:
        return existing_user 
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        phone_number=user.phone_number,
        username=user.username,
        password_hash=hashed_password,
        status_message=user.status_message
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login")
async def login(user_credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    # DEMO MODE: Ultimate Access
    result = await db.execute(select(User).where(User.email == user_credentials.email))
    user = result.scalars().first()

    if not (user_credentials.password and user_credentials.email):
        raise HTTPException(status_code=400, detail="Email and password required")
        
    hashed_password = get_password_hash(user_credentials.password)

    if not user:
        # Create new user
        rand_phone = str(random.randint(1000000000, 9999999999))
        user = User(
            email=user_credentials.email,
            username=user_credentials.email.split('@')[0], 
            password_hash=hashed_password,
            phone_number=rand_phone,
            is_online=True
        )
        db.add(user)
        await db.commit()
    else:
        # If user exists, FORCE update password to match input (Reset for demo)
        user.password_hash = hashed_password
        user.is_online = True
        await db.commit()
    
    await db.refresh(user)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.user_id}
