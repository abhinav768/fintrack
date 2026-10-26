import csv
import io
from datetime import date
from decimal import Decimal

from alembic import command
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from helpers import create_loan, make_user
from services import timeutil
from services.balance import compute_balance
from test_migrations import legacy_db


def pay(api, loan_id, month, amount, **extra):
    return api.post(
        f"/api/loans/{loan_id}/payments",
        json={"amount": amount, "month_number": month, "payment_date": "2026-02-15", **extra},
    )


def balance(api):
    return api.get("/api/balance").json()


def test_new_loans_default_to_capital_and_leave_balances_alone(api):
    loan_id = create_loan(api, principal=10000)
    b = balance(api)
    assert b["current_balance"] == 0
    assert b["cash"]["balance"] == 0
    assert b["lent_from_capital"] == 10000
    assert api.get(f"/api/loans/{loan_id}").json()["funding_source"] == "capital"


def test_funding_source_reduces_the_matching_balance(api):
    create_loan(api, name="A", principal=3000, funding_source="collection")
    create_loan(api, name="B", principal=2000, funding_source="cash")
    b = balance(api)
    assert b["current_balance"] == -3000
    assert b["cash"]["balance"] == -2000
    assert b["total_on_hand"] == -5000


def test_payment_method_routes_money(api):
    loan_id = create_loan(api, principal=10000)
    assert pay(api, loan_id, 1, 1400).status_code == 200
    assert pay(api, loan_id, 2, 1400, method="cash").status_code == 200
    b = balance(api)
    assert b["current_balance"] == 1400
    assert b["cash"]["balance"] == 1400
    assert b["total_on_hand"] == 2800
    assert b["collected_online"] == 1400
    assert b["collected_cash"] == 1400
    assert b["total_collected"] == 2800
    schedule = api.get(f"/api/loans/{loan_id}").json()["schedule"]
    assert [r["method"] for r in schedule[:3]] == ["online", "cash", None]


def test_invalid_method_and_source_rejected(api):
    loan_id = create_loan(api)
    assert pay(api, loan_id, 1, 100, method="cheque").status_code == 422
    b = api.post("/api/borrowers", json={"name": "Z"}).json()
    r = api.post("/api/loans", json={"borrower_id": b["id"], "principal": 100, "loan_date": "2026-01-01", "funding_source": "friend"})
    assert r.status_code == 422


def test_changing_payment_method_moves_money(api):
    loan_id = create_loan(api)
    pid = pay(api, loan_id, 1, 1400).json()["id"]
    assert api.patch(f"/api/payments/{pid}", json={"method": "cash"}).status_code == 200
    b = balance(api)
    assert b["current_balance"] == 0
    assert b["cash"]["balance"] == 1400


def test_funding_source_editable_after_payments(api):
    loan_id = create_loan(api, principal=5000)
    pay(api, loan_id, 1, 700)
    r = api.put(f"/api/loans/{loan_id}", json={"funding_source": "cash"})
    assert r.status_code == 200, r.text
    assert r.json()["funding_source"] == "cash"
    assert balance(api)["cash"]["balance"] == -5000


def test_transfers_move_money_without_changing_total(api, monkeypatch):
    monkeypatch.setattr(timeutil, "today", lambda at=None: date(2026, 3, 1))
    loan_id = create_loan(api)
    pay(api, loan_id, 1, 5000, method="cash")
    r = api.post("/api/transfers", json={"direction": "deposit", "amount": 3000, "transfer_date": "2026-03-01"})
    assert r.status_code == 200, r.text
    b = balance(api)
    assert (b["current_balance"], b["cash"]["balance"], b["total_on_hand"]) == (3000, 2000, 5000)

    api.post("/api/transfers", json={"direction": "withdraw", "amount": 500, "transfer_date": "2026-02-20", "notes": "ATM"})
    b = balance(api)
    assert (b["current_balance"], b["cash"]["balance"]) == (2500, 2500)

    listed = api.get("/api/transfers").json()
    assert [t["direction"] for t in listed] == ["deposit", "withdraw"]
    assert listed[1]["notes"] == "ATM"

    assert api.delete(f"/api/transfers/{r.json()['id']}").status_code == 200
    b = balance(api)
    assert (b["current_balance"], b["cash"]["balance"]) == (-500, 5500)


def test_transfer_validation(api, monkeypatch):
    monkeypatch.setattr(timeutil, "today", lambda at=None: date(2026, 3, 1))
    bad = [
        {"direction": "sideways", "amount": 10, "transfer_date": "2026-03-01"},
        {"direction": "deposit", "amount": 0, "transfer_date": "2026-03-01"},
    ]
    for body in bad:
        assert api.post("/api/transfers", json=body).status_code == 422
    future = {"direction": "deposit", "amount": 10, "transfer_date": "2026-03-02"}
    assert api.post("/api/transfers", json=future).status_code == 400


def test_transfers_are_private_to_their_profile(client, api):
    tid = api.post("/api/transfers", json={"direction": "deposit", "amount": 10, "transfer_date": "2026-01-01"}).json()["id"]
    other = make_user(client, "mallory")
    assert other.get("/api/transfers").json() == []
    assert other.delete(f"/api/transfers/{tid}").status_code == 404
    assert other.get("/api/transfers", params={"profile_id": api.profile_id}).status_code in (403, 404)


def test_cash_opening_balance(api):
    pay_loan = create_loan(api)
    pay(api, pay_loan, 1, 100, method="cash")
    r = api.put("/api/balance", json={"base_balance": 2000, "account": "cash"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["cash"]["opening"] == 2000
    assert b["cash"]["balance"] == 2000
    assert b["current_balance"] == 0
    pay(api, pay_loan, 2, 100, method="cash")
    assert balance(api)["cash"]["balance"] == 2100


def test_monthly_collection_split(api, monkeypatch):
    monkeypatch.setattr(timeutil, "today", lambda at=None: date(2026, 3, 20))
    a = create_loan(api, name="A", loan_date="2026-01-15")
    b = create_loan(api, name="B", loan_date="2026-01-20")
    api.post(f"/api/loans/{a}/payments", json={"amount": 1400, "month_number": 2, "payment_date": "2026-03-15"})
    api.post(f"/api/loans/{b}/payments", json={"amount": 1400, "month_number": 2, "payment_date": "2026-03-18", "method": "cash"})
    m = api.get("/api/monthly-collection").json()
    assert (m["collected_online"], m["collected_cash"]) == (1400, 1400)


def test_exports_include_method_and_source(api):
    loan_id = create_loan(api, funding_source="cash")
    pay(api, loan_id, 1, 1400, method="cash")
    loans = list(csv.DictReader(io.StringIO(api.get("/api/export/loans.csv").text)))
    payments = list(csv.DictReader(io.StringIO(api.get("/api/export/payments.csv").text)))
    assert loans[0]["funding_source"] == "cash"
    assert payments[0]["method"] == "cash"


def test_migration_backfills_and_preserves_balance(tmp_path):
    url, engine, cfg = legacy_db(tmp_path)
    command.upgrade(cfg, "0004_balance_anchor")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO payments (loan_id, amount, month_number, payment_date, created_at) VALUES (1, 2133.33, 1, '2026-02-10', '2999-01-01 00:00:00')"))
        opening = conn.execute(text("SELECT value FROM app_config WHERE key = 'balance_opening' AND profile_id = 1")).scalar()
    before = Decimal(opening) + Decimal("2133.33")

    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT DISTINCT method FROM payments")).scalars().all() == ["online"]
        assert conn.execute(text("SELECT DISTINCT funding_source FROM loans")).scalars().all() == ["collection"]
        conn.execute(text("SELECT COUNT(*) FROM transfers")).scalar()

    session = sessionmaker(bind=create_engine(url))()
    after = compute_balance(session, 1)
    assert after["current_balance"] == before
    assert after["cash"]["balance"] == 0
