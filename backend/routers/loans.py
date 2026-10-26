import logging
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_profile_borrower, get_profile_loan, profile_loans_query, require_profile
from services import timeutil
from services.loan_terms import compute_loan_terms, cycle_start, monthly_rate_of
from services.money import to_money
from services.schedule import build_schedule

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")


def loans_with_details(db: Session, profile_id: int):
    return profile_loans_query(db, profile_id).options(
        joinedload(models.Loan.borrower), selectinload(models.Loan.payments)
    )


def loan_summary(loan: models.Loan, today) -> dict:
    schedule = build_schedule(loan, today)
    total_paid = sum((to_money(p.amount) for p in loan.payments), Decimal("0"))
    return {
        "id": loan.id,
        "borrower_name": loan.borrower.name,
        "borrower_id": loan.borrower_id,
        "principal": loan.principal,
        "total_return": loan.total_return,
        "monthly_emi": loan.monthly_emi,
        "monthly_rate": monthly_rate_of(loan),
        "total_months": loan.total_months,
        "loan_date": str(loan.loan_date),
        "cycle_start_date": str(loan.cycle_start_date),
        "status": loan.status,
        "funding_source": loan.funding_source or "collection",
        "months_paid": sum(1 for row in schedule if row["status"] == "paid"),
        "overdue_count": sum(1 for row in schedule if row["overdue"]),
        "total_paid": total_paid,
        "remaining": to_money(loan.total_return) - total_paid,
    }


def apply_terms(loan: models.Loan, principal, monthly_rate, months: int, loan_date) -> None:
    terms = compute_loan_terms(principal, monthly_rate, months)
    loan.principal = to_money(principal)
    loan.interest_rate = terms.interest_pct
    loan.total_return = terms.total_return
    loan.monthly_emi = terms.monthly_emi
    loan.total_months = months
    loan.loan_date = loan_date
    loan.cycle_start_date = cycle_start(loan_date)


@router.get("/loans")
def list_loans(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    today = timeutil.today()
    return [loan_summary(loan, today) for loan in loans_with_details(db, profile.id).all()]


@router.get("/loans/preview")
def preview_loan(
    principal: Decimal = Query(..., gt=0, le=schemas.MAX_AMOUNT),
    months: int = Query(..., ge=1, le=120),
    monthly_rate: Decimal = Query(Decimal("4"), ge=0, le=20),
    user: models.User = Depends(get_current_user),
):
    terms = compute_loan_terms(principal, monthly_rate, months)
    return {
        "interest_pct": terms.interest_pct,
        "total_return": terms.total_return,
        "monthly_emi": terms.monthly_emi,
        "last_emi": terms.last_emi,
    }


@router.get("/overdue")
def list_overdue(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    today = timeutil.today()
    items = []
    for loan in loans_with_details(db, profile.id).filter(models.Loan.status == "active").all():
        for row in build_schedule(loan, today):
            if not row["overdue"]:
                continue
            due = date.fromisoformat(row["due_date"])
            items.append({
                "loan_id": loan.id,
                "borrower_id": loan.borrower_id,
                "borrower_name": loan.borrower.name,
                "month_number": row["month_number"],
                "due_date": row["due_date"],
                "expected_amount": row["expected_amount"],
                "paid_amount": row["paid_amount"],
                "outstanding": row["outstanding"],
                "days_overdue": (today - due).days,
            })
    items.sort(key=lambda i: (i["due_date"], i["borrower_name"]))
    return {
        "count": len(items),
        "total_outstanding": sum((i["outstanding"] for i in items), Decimal("0")),
        "items": items,
    }


@router.post("/loans")
def create_loan(
    loan: schemas.LoanCreate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    borrower = get_profile_borrower(db, loan.borrower_id, profile)

    db_loan = models.Loan(borrower_id=borrower.id, status="active", funding_source=loan.funding_source)
    apply_terms(db_loan, loan.principal, loan.monthly_rate, loan.total_months, loan.loan_date)
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    logger.info("Loan created: id=%d, borrower=%s, principal=%s, profile=%d",
                db_loan.id, borrower.name, db_loan.principal, profile.id,
                extra={"extra_fields": {
                    "event_type": "loan_created", "loan_id": db_loan.id,
                    "borrower": borrower.name, "principal": float(db_loan.principal),
                    "profile_id": profile.id,
                }})
    return {
        "id": db_loan.id,
        "principal": db_loan.principal,
        "total_return": db_loan.total_return,
        "monthly_emi": db_loan.monthly_emi,
        "loan_date": str(db_loan.loan_date),
        "cycle_start_date": str(db_loan.cycle_start_date),
        "funding_source": db_loan.funding_source,
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
    today = timeutil.today()
    return {
        **loan_summary(loan, today),
        "interest_rate": loan.interest_rate,
        "has_payments": bool(loan.payments),
        "schedule": build_schedule(loan, today),
    }


@router.put("/loans/{loan_id}")
def update_loan(
    loan_id: int,
    data: schemas.LoanUpdate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    loan = get_profile_loan(db, loan_id, profile)

    if data.borrower_id is not None:
        loan.borrower_id = get_profile_borrower(db, data.borrower_id, profile).id
    if data.funding_source is not None:
        loan.funding_source = data.funding_source

    term_fields = (data.principal, data.monthly_rate, data.total_months, data.loan_date)
    if any(v is not None for v in term_fields):
        if loan.payments:
            raise HTTPException(
                status_code=400,
                detail="Amount, rate, tenure and date can't be changed after payments are recorded",
            )
        apply_terms(
            loan,
            data.principal if data.principal is not None else loan.principal,
            data.monthly_rate if data.monthly_rate is not None else monthly_rate_of(loan),
            data.total_months if data.total_months is not None else loan.total_months,
            data.loan_date if data.loan_date is not None else loan.loan_date,
        )

    db.commit()
    db.refresh(loan)
    return loan_summary(loan, timeutil.today())


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
