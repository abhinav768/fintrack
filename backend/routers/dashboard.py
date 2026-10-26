from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import profile_loans_query, require_profile
from routers.loans import loans_with_details
from services import timeutil
from services.balance import compute_balance, set_opening_balance
from services.money import to_money
from services.schedule import build_schedule

router = APIRouter(prefix="/api")


def _total_collected(db: Session, profile_id: int) -> Decimal:
    loan_ids = profile_loans_query(db, profile_id).with_entities(models.Loan.id)
    return to_money(
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .filter(models.Payment.loan_id.in_(loan_ids))
        .scalar()
    )


@router.get("/dashboard")
def get_dashboard(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    loans = profile_loans_query(db, profile.id).all()
    total_principal = sum((to_money(l.principal) for l in loans), Decimal("0"))
    total_expected = sum((to_money(l.total_return) for l in loans), Decimal("0"))
    total_collected = _total_collected(db, profile.id)

    return {
        "total_principal_given": total_principal,
        "total_expected_return": total_expected,
        "total_collected": total_collected,
        "total_pending": total_expected - total_collected,
        "active_loans": sum(1 for l in loans if l.status == "active"),
        "completed_loans": sum(1 for l in loans if l.status == "completed"),
        "total_loans": len(loans),
    }


@router.get("/balance")
def get_balance(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    return compute_balance(db, profile.id)


@router.put("/balance")
def update_base_balance(
    data: schemas.BalanceUpdate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    set_opening_balance(db, profile.id, data.base_balance)
    db.commit()
    return compute_balance(db, profile.id)


@router.get("/monthly-collection")
def get_monthly_collection(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    today = timeutil.today()
    month_prefix = today.strftime("%Y-%m-")
    emis_due = []
    expected_total = Decimal("0")
    collected_total = Decimal("0")

    for loan in loans_with_details(db, profile.id).all():
        for row in build_schedule(loan, today):
            if not row["due_date"].startswith(month_prefix):
                continue
            expected_total += row["expected_amount"]
            collected_total += row["paid_amount"]
            emis_due.append({
                "loan_id": loan.id,
                "borrower_name": loan.borrower.name,
                "month_number": row["month_number"],
                "emi_amount": row["expected_amount"],
                "status": row["status"],
                "paid": row["paid"],
                "paid_amount": row["paid_amount"],
                "due_date": row["due_date"],
            })

    return {
        "month": today.strftime("%B %Y"),
        "expected_total": expected_total,
        "collected_total": collected_total,
        "pending_total": expected_total - collected_total,
        "emis": emis_due,
    }
