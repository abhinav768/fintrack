from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import profile_loans_query, require_profile

router = APIRouter(prefix="/api")


@router.get("/profiles")
def list_profiles(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profiles = (
        db.query(models.Profile)
        .filter(models.Profile.user_id == user.id)
        .order_by(models.Profile.id)
        .all()
    )
    return [{"id": p.id, "name": p.name, "created_at": str(p.created_at)} for p in profiles]


@router.post("/profiles")
def create_profile(
    data: schemas.ProfileCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = models.Profile(user_id=user.id, name=data.name)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {"id": profile.id, "name": profile.name}


@router.put("/profiles/{profile_id}")
def update_profile(
    profile_id: int,
    data: schemas.ProfileUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    profile.name = data.name
    db.commit()
    return {"id": profile.id, "name": profile.name}


@router.delete("/profiles/{profile_id}")
def delete_profile(
    profile_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    has_active = profile_loans_query(db, profile.id).filter(models.Loan.status == "active").count()
    if has_active:
        raise HTTPException(status_code=400, detail="Cannot delete profile with active loans")
    profile_count = db.query(models.Profile).filter(models.Profile.user_id == user.id).count()
    if profile_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete your only profile")
    db.delete(profile)
    db.commit()
    return {"message": "Profile deleted"}
