from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_config, profile_loans_query, require_profile, set_config

router = APIRouter(prefix="/api")

INITIAL_BALANCE = 53600.0


def _total_collected(db: Session, profile_id: int) -> float:
    loan_ids = profile_loans_query(db, profile_id).with_entities(models.Loan.id)
    return float(
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
    total_principal = sum(l.principal for l in loans)
    total_expected = sum(l.total_return for l in loans)
    total_collected = _total_collected(db, profile.id) if loans else 0.0

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
    base = float(get_config(db, "base_balance", profile.id, str(INITIAL_BALANCE)))
    snapshot = float(get_config(db, "collections_snapshot", profile.id, "0"))
    total_collected = _total_collected(db, profile.id)
    new_collections = total_collected - snapshot
    return {
        "base_balance": base,
        "new_collections": new_collections,
        "current_balance": base + new_collections,
        "total_collected": total_collected,
    }


@router.put("/balance")
def update_base_balance(
    data: schemas.BalanceUpdate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    total_collected = _total_collected(db, profile.id)
    set_config(db, "base_balance", profile.id, str(data.base_balance))
    set_config(db, "collections_snapshot", profile.id, str(total_collected))
    db.commit()
    return {"base_balance": data.base_balance, "snapshot": total_collected}


@router.get("/monthly-collection")
def get_monthly_collection(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    today = date.today()
    loans = profile_loans_query(db, profile.id).all()
    emis_due = []
    expected_total = 0.0
    collected_total = 0.0

    for loan in loans:
        payments_map = {p.month_number: p for p in loan.payments}
        for month_num in range(1, loan.total_months + 1):
            due_date = loan.cycle_start_date + relativedelta(months=month_num - 1)
            if due_date.year == today.year and due_date.month == today.month:
                payment = payments_map.get(month_num)
                paid_amount = payment.amount if payment else 0
                expected_total += loan.monthly_emi
                collected_total += paid_amount
                emis_due.append({
                    "loan_id": loan.id,
                    "borrower_name": loan.borrower.name,
                    "month_number": month_num,
                    "emi_amount": loan.monthly_emi,
                    "paid": payment is not None,
                    "paid_amount": paid_amount,
                    "due_date": str(due_date),
                })

    return {
        "month": today.strftime("%B %Y"),
        "expected_total": expected_total,
        "collected_total": collected_total,
        "pending_total": expected_total - collected_total,
        "emis": emis_due,
    }
