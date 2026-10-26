from datetime import datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from deps import get_config, profile_loans_query, set_config
from services import timeutil
from services.money import to_money

OPENING_KEY = "balance_opening"
ANCHOR_KEY = "balance_anchor_at"


def compute_balance(db: Session, profile_id: int) -> dict:
    """opening balance + collections recorded after the anchor - principal lent after the anchor."""
    opening = to_money(get_config(db, OPENING_KEY, profile_id, "0"))
    anchor_raw = get_config(db, ANCHOR_KEY, profile_id, "")
    anchor = datetime.fromisoformat(anchor_raw) if anchor_raw else None

    loans = profile_loans_query(db, profile_id)
    loan_ids = loans.with_entities(models.Loan.id)

    payments = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(
        models.Payment.loan_id.in_(loan_ids)
    )
    total_collected = to_money(payments.scalar())
    lent = loans.with_entities(func.coalesce(func.sum(models.Loan.principal), 0))
    if anchor is not None:
        payments = payments.filter(models.Payment.created_at > anchor)
        lent = lent.filter(models.Loan.created_at > anchor)

    new_collections = to_money(payments.scalar())
    new_lending = to_money(lent.scalar())
    return {
        "base_balance": opening,
        "new_collections": new_collections,
        "new_lending": new_lending,
        "current_balance": opening + new_collections - new_lending,
        "total_collected": total_collected,
        "anchor_at": anchor_raw or None,
    }


def set_opening_balance(db: Session, profile_id: int, value: Decimal) -> None:
    set_config(db, OPENING_KEY, profile_id, str(to_money(value)))
    set_config(db, ANCHOR_KEY, profile_id, timeutil.utcnow_naive().isoformat())
