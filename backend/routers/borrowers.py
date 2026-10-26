import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_profile_borrower, require_profile

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")


@router.get("/borrowers")
def list_borrowers(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    borrowers = db.query(models.Borrower).filter(models.Borrower.profile_id == profile.id).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "phone": b.phone,
            "active_loans": sum(1 for l in b.loans if l.status == "active"),
            "total_loans": len(b.loans),
        }
        for b in borrowers
    ]


@router.post("/borrowers")
def create_borrower(
    borrower: schemas.BorrowerCreate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    db_borrower = models.Borrower(name=borrower.name, phone=borrower.phone, profile_id=profile.id)
    db.add(db_borrower)
    db.commit()
    db.refresh(db_borrower)
    logger.info("Borrower created: id=%d, name=%s, profile=%d",
                db_borrower.id, db_borrower.name, profile.id,
                extra={"extra_fields": {
                    "event_type": "borrower_created", "borrower_id": db_borrower.id,
                    "borrower": db_borrower.name, "profile_id": profile.id,
                }})
    return {"id": db_borrower.id, "name": db_borrower.name, "phone": db_borrower.phone}


@router.delete("/borrowers/{borrower_id}")
def delete_borrower(
    borrower_id: int,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    borrower = get_profile_borrower(db, borrower_id, profile)
    if any(l.status == "active" for l in borrower.loans):
        raise HTTPException(status_code=400, detail="Cannot delete borrower with active loans")
    db.delete(borrower)
    db.commit()
    return {"message": "Borrower deleted"}
