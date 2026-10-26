from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
from deps import get_config, profile_loans_query, set_config
from services import timeutil
from services.money import to_money

ONLINE, CASH = "online", "cash"
CAPITAL, COLLECTION = "capital", "collection"
DEPOSIT, WITHDRAW = "deposit", "withdraw"

# Each tracked place: (config keys, payment method, loan funding source, transfer direction that adds money).
ACCOUNTS = {
    COLLECTION: (("balance_opening", "balance_anchor_at"), ONLINE, COLLECTION, DEPOSIT),
    CASH: (("cash_opening", "cash_anchor_at"), CASH, CASH, WITHDRAW),
}


def _matches(column, value, null_means):
    """NULL rows predate the column (or were written by the previous release mid-deploy)."""
    return or_(column == value, column.is_(None)) if value == null_means else column == value


def _sum(query) -> Decimal:
    return to_money(query.scalar())


def _account(db: Session, profile_id: int, name: str) -> dict:
    (opening_key, anchor_key), method, source, inbound = ACCOUNTS[name]
    opening = to_money(get_config(db, opening_key, profile_id, "0"))
    anchor_raw = get_config(db, anchor_key, profile_id, "")
    anchor = datetime.fromisoformat(anchor_raw) if anchor_raw else None

    loans = profile_loans_query(db, profile_id)
    payments = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(
        models.Payment.loan_id.in_(loans.with_entities(models.Loan.id)),
        _matches(models.Payment.method, method, ONLINE),
    )
    lent = loans.with_entities(func.coalesce(func.sum(models.Loan.principal), 0)).filter(
        _matches(models.Loan.funding_source, source, COLLECTION)
    )
    transfers = db.query(func.coalesce(func.sum(models.Transfer.amount), 0)).filter(
        models.Transfer.profile_id == profile_id
    )
    if anchor is not None:
        payments = payments.filter(models.Payment.created_at > anchor)
        lent = lent.filter(models.Loan.created_at > anchor)
        transfers = transfers.filter(models.Transfer.created_at > anchor)

    collections = _sum(payments)
    lending = _sum(lent)
    transfers_in = _sum(transfers.filter(models.Transfer.direction == inbound))
    transfers_out = _sum(transfers.filter(models.Transfer.direction != inbound))
    return {
        "opening": opening,
        "collections": collections,
        "lending": lending,
        "transfers_in": transfers_in,
        "transfers_out": transfers_out,
        "balance": opening + collections - lending + transfers_in - transfers_out,
        "anchor_at": anchor_raw or None,
    }


def _collected(db: Session, profile_id: int, method: str) -> Decimal:
    loan_ids = profile_loans_query(db, profile_id).with_entities(models.Loan.id)
    return _sum(
        db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(
            models.Payment.loan_id.in_(loan_ids), _matches(models.Payment.method, method, ONLINE)
        )
    )


def compute_balance(db: Session, profile_id: int) -> dict:
    """Collection account and cash in hand: opening + money in - money out since the opening was set."""
    collection = _account(db, profile_id, COLLECTION)
    cash = _account(db, profile_id, CASH)
    online, in_cash = _collected(db, profile_id, ONLINE), _collected(db, profile_id, CASH)
    capital = _sum(
        profile_loans_query(db, profile_id)
        .with_entities(func.coalesce(func.sum(models.Loan.principal), 0))
        .filter(models.Loan.funding_source == CAPITAL)
    )
    return {
        "base_balance": collection["opening"],
        "new_collections": collection["collections"],
        "new_lending": collection["lending"],
        "current_balance": collection["balance"],
        "anchor_at": collection["anchor_at"],
        "collection": collection,
        "cash": cash,
        "total_on_hand": collection["balance"] + cash["balance"],
        "collected_online": online,
        "collected_cash": in_cash,
        "total_collected": online + in_cash,
        "lent_from_capital": capital,
    }


def set_opening_balance(db: Session, profile_id: int, value: Decimal, account: str = COLLECTION) -> None:
    opening_key, anchor_key = ACCOUNTS[account][0]
    set_config(db, opening_key, profile_id, str(to_money(value)))
    set_config(db, anchor_key, profile_id, timeutil.utcnow_naive().isoformat())
