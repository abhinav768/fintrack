import logging

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_profile_borrower, get_profile_loan, profile_loans_query, require_profile

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")

MONTHLY_INTEREST_RATE = 4  # 4% per month simple interest


@router.get("/loans")
def list_loans(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    result = []
    for loan in profile_loans_query(db, profile.id).all():
        total_paid = sum(p.amount for p in loan.payments)
        result.append({
            "id": loan.id,
            "borrower_name": loan.borrower.name,
            "borrower_id": loan.borrower_id,
            "principal": loan.principal,
            "total_return": loan.total_return,
            "monthly_emi": loan.monthly_emi,
            "total_months": loan.total_months,
            "loan_date": str(loan.loan_date),
            "cycle_start_date": str(loan.cycle_start_date),
            "status": loan.status,
            "months_paid": len(loan.payments),
            "total_paid": total_paid,
            "remaining": loan.total_return - total_paid,
        })
    return result


@router.post("/loans")
def create_loan(
    loan: schemas.LoanCreate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    borrower = get_profile_borrower(db, loan.borrower_id, profile)

    months = loan.total_months
    interest_pct = MONTHLY_INTEREST_RATE * months
    total_return = loan.principal * (1 + interest_pct / 100)
    monthly_emi = total_return / months
    cycle_start = loan.loan_date + relativedelta(months=1)

    db_loan = models.Loan(
        borrower_id=loan.borrower_id,
        principal=loan.principal,
        interest_rate=interest_pct,
        total_return=total_return,
        monthly_emi=monthly_emi,
        total_months=months,
        loan_date=loan.loan_date,
        cycle_start_date=cycle_start,
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    logger.info("Loan created: id=%d, borrower=%s, principal=%.0f, profile=%d",
                db_loan.id, borrower.name, loan.principal, profile.id,
                extra={"extra_fields": {
                    "event_type": "loan_created", "loan_id": db_loan.id,
                    "borrower": borrower.name, "principal": loan.principal,
                    "profile_id": profile.id,
                }})
    return {
        "id": db_loan.id,
        "principal": db_loan.principal,
        "total_return": db_loan.total_return,
        "monthly_emi": db_loan.monthly_emi,
        "loan_date": str(db_loan.loan_date),
        "cycle_start_date": str(db_loan.cycle_start_date),
    }


@router.get("/loans/{loan_id}")
def get_loan(
    loan_id: int,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    loan = get_profile_loan(db, loan_id, profile)
    payments_map = {p.month_number: p for p in loan.payments}

    schedule = []
    for month in range(1, loan.total_months + 1):
        payment = payments_map.get(month)
        due_date = loan.cycle_start_date + relativedelta(months=month - 1)
        schedule.append({
            "month_number": month,
            "due_date": str(due_date),
            "expected_amount": loan.monthly_emi,
            "paid": payment is not None,
            "paid_amount": payment.amount if payment else 0,
            "payment_date": str(payment.payment_date) if payment else None,
            "payment_id": payment.id if payment else None,
            "notes": payment.notes if payment else None,
        })

    total_paid = sum(p.amount for p in loan.payments)
    return {
        "id": loan.id,
        "borrower_name": loan.borrower.name,
        "borrower_id": loan.borrower_id,
        "principal": loan.principal,
        "interest_rate": loan.interest_rate,
        "total_return": loan.total_return,
        "monthly_emi": loan.monthly_emi,
        "total_months": loan.total_months,
        "loan_date": str(loan.loan_date),
        "cycle_start_date": str(loan.cycle_start_date),
        "status": loan.status,
        "schedule": schedule,
        "total_paid": total_paid,
        "remaining": loan.total_return - total_paid,
    }


@router.delete("/loans/{loan_id}")
def delete_loan(
    loan_id: int,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    loan = get_profile_loan(db, loan_id, profile)
    logger.info("Loan deleted: id=%d, borrower=%s, profile=%d",
                loan.id, loan.borrower.name, profile.id,
                extra={"extra_fields": {
                    "event_type": "loan_deleted", "loan_id": loan.id,
                    "borrower": loan.borrower.name, "profile_id": profile.id,
                }})
    db.delete(loan)
    db.commit()
    return {"message": "Loan deleted"}
