from decimal import Decimal

from alembic import command
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from helpers import create_loan as _create_loan
from services.balance import compute_balance
from test_migrations import legacy_db


def pay(api, loan_id, month, amount):
    return api.post(
        f"/api/loans/{loan_id}/payments",
        json={"amount": amount, "month_number": month, "payment_date": "2026-02-15"},
    )


def create_loan(api, **kw):
    return _create_loan(api, funding_source="collection", **kw)


def test_new_profile_starts_at_zero_and_tracks_lending(api):
    assert api.get("/api/balance").json()["current_balance"] == 0
    loan_id = create_loan(api, principal=10000)
    b = api.get("/api/balance").json()
    assert b["new_lending"] == 10000
    assert b["current_balance"] == -10000
    pay(api, loan_id, 1, 1400)
    b = api.get("/api/balance").json()
    assert b["new_collections"] == 1400
    assert b["current_balance"] == -8600


def test_setting_balance_resets_anchor(api):
    loan_id = create_loan(api, principal=10000)
    pay(api, loan_id, 1, 1400)
    assert api.put("/api/balance", json={"base_balance": 50000}).status_code == 200
    b = api.get("/api/balance").json()
    assert b["base_balance"] == 50000
    assert b["current_balance"] == 50000

    create_loan(api, name="Zed", principal=5000)
    pay(api, loan_id, 2, 1400)
    b = api.get("/api/balance").json()
    assert b["current_balance"] == 50000 - 5000 + 1400


def test_deleting_new_payment_reverses_it(api):
    api.put("/api/balance", json={"base_balance": 1000})
    loan_id = create_loan(api, principal=500)
    pid = pay(api, loan_id, 1, 54).json()["id"]
    assert api.get("/api/balance").json()["current_balance"] == 1000 - 500 + 54
    api.delete(f"/api/payments/{pid}")
    assert api.get("/api/balance").json()["current_balance"] == 500


def _legacy_balance_case(tmp_path, config_rows):
    url, engine, cfg = legacy_db(tmp_path)
    command.upgrade(cfg, "0003_payment_unique")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO payments (loan_id, amount, month_number, payment_date, created_at) VALUES (1, 2133.33, 1, '2026-02-10', '2026-02-10 10:00:00')"))
        conn.execute(text("INSERT INTO payments (loan_id, amount, month_number, payment_date, created_at) VALUES (1, 2133.33, 2, '2026-03-10', '2026-03-10 10:00:00')"))
        for key, value in config_rows:
            conn.execute(text("INSERT INTO app_config (key, profile_id, value) VALUES (:k, 1, :v)"), {"k": key, "v": value})
    command.upgrade(cfg, "head")
    session = sessionmaker(bind=create_engine(url))()
    return compute_balance(session, 1)


def test_migration_preserves_default_53600_balance(tmp_path):
    b = _legacy_balance_case(tmp_path, [])
    assert b["current_balance"] == Decimal("53600") + Decimal("4266.66")


def test_migration_preserves_edited_balance(tmp_path):
    b = _legacy_balance_case(tmp_path, [("base_balance", "70000.0"), ("collections_snapshot", "2133.33")])
    assert b["current_balance"] == Decimal("70000") + Decimal("2133.33")
    assert b["new_lending"] == 0
