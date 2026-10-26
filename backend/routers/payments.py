import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_profile_loan, require_profile

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")


@router.post("/loans/{loan_id}/payments")
def add_payment(
    loan_id: int,
    payment: schemas.PaymentCreate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    loan = get_profile_loan(db, loan_id, profile)

    existing = (
        db.query(models.Payment)
        .filter(models.Payment.loan_id == loan_id, models.Payment.month_number == payment.month_number)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Payment already recorded for this month")

    db_payment = models.Payment(
        loan_id=loan_id,
        amount=payment.amount,
        month_number=payment.month_number,
        payment_date=payment.payment_date,
        notes=payment.notes,
    )
    db.add(db_payment)

    paid_count = db.query(models.Payment).filter(models.Payment.loan_id == loan_id).count()
    if paid_count + 1 >= loan.total_months:
        loan.status = "completed"
        logger.info("Loan completed: id=%d, borrower=%s", loan.id, loan.borrower.name,
                    extra={"extra_fields": {"event_type": "loan_completed", "loan_id": loan.id}})

    db.commit()
    db.refresh(db_payment)
    logger.info("Payment recorded: loan=%d, month=%d, amount=%.0f, borrower=%s",
                loan_id, payment.month_number, payment.amount, loan.borrower.name,
                extra={"extra_fields": {
                    "event_type": "payment_recorded", "loan_id": loan_id,
                    "month_number": payment.month_number, "amount": payment.amount,
                    "borrower": loan.borrower.name, "profile_id": profile.id,
                }})
    return {
        "id": db_payment.id,
        "amount": db_payment.amount,
        "month_number": db_payment.month_number,
        "payment_date": str(db_payment.payment_date),
    }


@router.delete("/payments/{payment_id}")
def delete_payment(
    payment_id: int,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    loan = get_profile_loan(db, payment.loan_id, profile)
    db.delete(payment)

    remaining_count = db.query(models.Payment).filter(models.Payment.loan_id == loan.id).count()
    if remaining_count - 1 < loan.total_months:
        loan.status = "active"

    db.commit()
    return {"message": "Payment deleted"}
