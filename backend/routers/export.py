import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db
from deps import require_profile
from routers.loans import loan_summary, loans_with_details
from services import timeutil
from services.money import to_money

router = APIRouter(prefix="/api")


def _cell(value) -> str:
    """Neutralise spreadsheet formula injection in user-entered text."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


def _csv_response(header: list[str], rows: list[list], filename: str) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return Response(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/loans.csv")
def export_loans(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    today = timeutil.today()
    rows = []
    for loan in loans_with_details(db, profile.id).order_by(models.Loan.id).all():
        s = loan_summary(loan, today)
        rows.append([
            loan.id, _cell(loan.borrower.name), _cell(loan.borrower.phone),
            to_money(loan.principal), s["monthly_rate"], to_money(loan.total_return),
            to_money(loan.monthly_emi), loan.total_months, loan.loan_date, loan.cycle_start_date,
            loan.status, s["months_paid"], s["total_paid"], s["remaining"], s["overdue_count"],
            s["funding_source"],
        ])
    header = [
        "loan_id", "borrower", "phone", "principal", "monthly_rate_pct", "total_return",
        "monthly_emi", "total_months", "loan_date", "cycle_start_date", "status",
        "months_paid", "total_paid", "remaining", "overdue_installments", "funding_source",
    ]
    return _csv_response(header, rows, "fintrack-loans.csv")


@router.get("/export/payments.csv")
def export_payments(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    rows = []
    for loan in loans_with_details(db, profile.id).order_by(models.Loan.id).all():
        for p in loan.payments:
            rows.append([
                p.id, loan.id, _cell(loan.borrower.name), p.month_number,
                to_money(p.amount), p.payment_date, _cell(p.notes), p.method or "online",
            ])
    header = ["payment_id", "loan_id", "borrower", "month_number", "amount", "payment_date", "notes", "method"]
    return _csv_response(header, rows, "fintrack-payments.csv")
