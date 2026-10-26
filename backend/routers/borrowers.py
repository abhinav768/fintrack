import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_profile_borrower, require_profile
from routers.loans import loan_summary
from services import timeutil
from services.money import to_money

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")


@router.get("/borrowers")
def list_borrowers(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    borrowers = (
        db.query(models.Borrower)
        .filter(models.Borrower.profile_id == profile.id)
        .options(selectinload(models.Borrower.loans))
        .order_by(models.Borrower.name)
        .all()
    )
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


@router.get("/borrowers/{borrower_id}")
def get_borrower(
    borrower_id: int,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    borrower = get_profile_borrower(db, borrower_id, profile)
    today = timeutil.today()
    loans = [loan_summary(loan, today) for loan in sorted(borrower.loans, key=lambda l: l.loan_date, reverse=True)]
    zero = Decimal("0")
    return {
        "id": borrower.id,
        "name": borrower.name,
        "phone": borrower.phone,
        "created_at": str(borrower.created_at),
        "loans": loans,
        "totals": {
            "lent": sum((to_money(l["principal"]) for l in loans), zero),
            "expected": sum((to_money(l["total_return"]) for l in loans), zero),
            "collected": sum((l["total_paid"] for l in loans), zero),
            "outstanding": sum((l["remaining"] for l in loans), zero),
            "overdue_count": sum(l["overdue_count"] for l in loans),
            "active_loans": sum(1 for l in loans if l["status"] == "active"),
        },
    }


@router.put("/borrowers/{borrower_id}")
def update_borrower(
    borrower_id: int,
    data: schemas.BorrowerUpdate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    borrower = get_profile_borrower(db, borrower_id, profile)
    borrower.name = data.name
    borrower.phone = data.phone or None
    db.commit()
    return {"id": borrower.id, "name": borrower.name, "phone": borrower.phone}


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
