import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import create_access_token, get_current_user, hash_password, verify_password
from database import get_db

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")


@router.post("/auth/signup")
def signup(data: schemas.UserSignup, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == data.username).first()
    if existing:
        logger.warning("Signup failed — username already taken: %s", data.username,
                       extra={"extra_fields": {"event_type": "auth_signup_failed", "username": data.username}})
        raise HTTPException(status_code=400, detail="Username already taken")
    user = models.User(username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    db.flush()
    db.add(models.Profile(user_id=user.id, name=f"{data.username}'s Portfolio"))
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    logger.info("New user signed up: %s (id=%d)", user.username, user.id,
                extra={"extra_fields": {"event_type": "auth_signup", "user_id": user.id, "username": user.username}})
    return {"token": token, "user": {"id": user.id, "username": user.username}}


@router.post("/auth/login")
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        logger.warning("Login failed for username: %s", data.username,
                       extra={"extra_fields": {"event_type": "auth_login_failed", "username": data.username}})
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user.id)
    logger.info("User logged in: %s (id=%d)", user.username, user.id,
                extra={"extra_fields": {"event_type": "auth_login", "user_id": user.id, "username": user.username}})
    return {"token": token, "user": {"id": user.id, "username": user.username}}


@router.get("/auth/me")
def get_me(user: models.User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username}
