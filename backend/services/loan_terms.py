from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta

import models
from services.money import CENT, to_money

DEFAULT_MONTHLY_RATE = Decimal("4")


@dataclass(frozen=True)
class LoanTerms:
    interest_pct: Decimal
    total_return: Decimal
    monthly_emi: Decimal
    last_emi: Decimal


def compute_loan_terms(principal, monthly_rate, months: int) -> LoanTerms:
    """Simple interest: total = principal * (1 + rate% * months). Last EMI absorbs rounding."""
    principal = to_money(principal)
    interest_pct = (Decimal(str(monthly_rate)) * months).quantize(CENT)
    total_return = to_money(principal * (1 + interest_pct / 100))
    monthly_emi = to_money(total_return / months)
    last_emi = total_return - monthly_emi * (months - 1)
    return LoanTerms(interest_pct, total_return, monthly_emi, last_emi)


def cycle_start(loan_date: date) -> date:
    return loan_date + relativedelta(months=1)


def monthly_rate_of(loan: models.Loan) -> Decimal:
    return (Decimal(str(loan.interest_rate)) / loan.total_months).quantize(CENT)


def installment_amount(loan: models.Loan, month_number: int) -> Decimal:
    emi = to_money(loan.monthly_emi)
    if month_number == loan.total_months:
        return to_money(loan.total_return) - emi * (loan.total_months - 1)
    return emi
