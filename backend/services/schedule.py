from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta

import models
from services.loan_terms import installment_amount
from services.money import ZERO, to_money

PAID_TOLERANCE = Decimal("0.50")


def due_date(loan: models.Loan, month_number: int) -> date:
    return loan.cycle_start_date + relativedelta(months=month_number - 1)


def installment_status(expected: Decimal, paid_amount) -> str:
    if paid_amount is None:
        return "pending"
    if to_money(paid_amount) >= expected - PAID_TOLERANCE:
        return "paid"
    return "partial"


def build_schedule(loan: models.Loan, today: date) -> list[dict]:
    payments = {p.month_number: p for p in loan.payments}
    rows = []
    for m in range(1, loan.total_months + 1):
        payment = payments.get(m)
        expected = installment_amount(loan, m)
        paid_amount = to_money(payment.amount) if payment else ZERO
        status = installment_status(expected, payment.amount if payment else None)
        due = due_date(loan, m)
        rows.append({
            "month_number": m,
            "due_date": str(due),
            "expected_amount": expected,
            "status": status,
            "paid": status == "paid",
            "overdue": status != "paid" and due < today,
            "paid_amount": paid_amount,
            "outstanding": ZERO if status == "paid" else max(expected - paid_amount, ZERO),
            "payment_date": str(payment.payment_date) if payment else None,
            "payment_id": payment.id if payment else None,
            "notes": payment.notes if payment else None,
        })
    return rows


def refresh_loan_status(loan: models.Loan) -> None:
    payments = {p.month_number: p.amount for p in loan.payments}
    fully_paid = all(
        installment_status(installment_amount(loan, m), payments.get(m)) == "paid"
        for m in range(1, loan.total_months + 1)
    )
    loan.status = "completed" if fully_paid else "active"
