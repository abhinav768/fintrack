import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_profile_loan, require_profile
from services import timeutil
from services.schedule import refresh_loan_status

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")


def _check_payment_date(payment_date) -> None:
    if payment_date > timeutil.today():
        raise HTTPException(status_code=400, detail="Payment date can't be in the future")


def _get_profile_payment(db: Session, payment_id: int, profile: models.Profile) -> tuple[models.Payment, models.Loan]:
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment, get_profile_loan(db, payment.loan_id, profile)


def _log_status_change(loan: models.Loan, previous: str) -> None:
    if loan.status == "completed" and previous != "completed":
        logger.info("Loan completed: id=%d, borrower=%s", loan.id, loan.borrower.name,
                    extra={"extra_fields": {"event_type": "loan_completed", "loan_id": loan.id}})


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

    if loan.status == "completed":
        raise HTTPException(status_code=400, detail="This loan is already fully paid")
    if payment.month_number > loan.total_months:
        raise HTTPException(status_code=400, detail=f"This loan only has {loan.total_months} months")
    _check_payment_date(payment.payment_date)
    if any(p.month_number == payment.month_number for p in loan.payments):
        raise HTTPException(status_code=400, detail="Payment already recorded for this month")

    db_payment = models.Payment(
        amount=payment.amount,
        month_number=payment.month_number,
        payment_date=payment.payment_date,
        notes=payment.notes,
        method=payment.method,
    )
    loan.payments.append(db_payment)
    previous = loan.status
    refresh_loan_status(loan)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Payment already recorded for this month")
    db.refresh(db_payment)
    _log_status_change(loan, previous)
    logger.info("Payment recorded: loan=%d, month=%d, amount=%s, borrower=%s",
                loan_id, payment.month_number, payment.amount, loan.borrower.name,
                extra={"extra_fields": {
                    "event_type": "payment_recorded", "loan_id": loan_id,
                    "month_number": payment.month_number, "amount": float(payment.amount),
                    "borrower": loan.borrower.name, "profile_id": profile.id,
                }})
    return {
        "id": db_payment.id,
        "amount": db_payment.amount,
        "month_number": db_payment.month_number,
        "payment_date": str(db_payment.payment_date),
        "method": db_payment.method,
    }


@router.patch("/payments/{payment_id}")
def update_payment(
    payment_id: int,
    data: schemas.PaymentUpdate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    payment, loan = _get_profile_payment(db, payment_id, profile)

    if data.amount is not None:
        payment.amount = data.amount
    if data.payment_date is not None:
        _check_payment_date(data.payment_date)
        payment.payment_date = data.payment_date
    if "notes" in data.model_fields_set:
        payment.notes = data.notes
    if data.method is not None:
        payment.method = data.method
    previous = loan.status
    refresh_loan_status(loan)
    db.commit()
    _log_status_change(loan, previous)
    return {
        "id": payment.id,
        "amount": payment.amount,
        "month_number": payment.month_number,
        "payment_date": str(payment.payment_date),
        "notes": payment.notes,
        "method": payment.method or "online",
    }


@router.delete("/payments/{payment_id}")
def delete_payment(
    payment_id: int,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    payment, loan = _get_profile_payment(db, payment_id, profile)
    loan.payments.remove(payment)
    refresh_loan_status(loan)
    db.commit()
    return {"message": "Payment deleted"}
