from decimal import Decimal

import pytest
from alembic import command
from sqlalchemy import create_engine, text

from bootstrap_db import alembic_config
from test_bootstrap import LEGACY_SCHEMA


def legacy_db(tmp_path):
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    engine = create_engine(url)
    with engine.begin() as conn:
        for stmt in LEGACY_SCHEMA:
            conn.execute(text(stmt))
        conn.execute(text("INSERT INTO users (id, username, password_hash) VALUES (1, 'abhinav', 'x')"))
        conn.execute(text("INSERT INTO profiles (id, user_id, name) VALUES (1, 1, 'Main')"))
        conn.execute(text("INSERT INTO borrowers (id, name, profile_id) VALUES (1, 'Ravi', 1)"))
        conn.execute(text(
            "INSERT INTO loans (id, borrower_id, principal, interest_rate, total_return, monthly_emi, total_months, loan_date, cycle_start_date, status) "
            "VALUES (1, 1, 20000, 60, 32000, 2133.3333333333335, 15, '2026-01-10', '2026-02-10', 'active')"
        ))
    cfg = alembic_config(url)
    command.stamp(cfg, "0001_baseline")
    return url, engine, cfg


def test_numeric_migration_rounds_to_paise(tmp_path):
    url, engine, cfg = legacy_db(tmp_path)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO payments (loan_id, amount, month_number, payment_date) VALUES (1, 2133.3333333333335, 1, '2026-02-10')"))
    command.upgrade(cfg, "0002_numeric_money")
    with engine.connect() as conn:
        emi, total = conn.execute(text("SELECT monthly_emi, total_return FROM loans")).one()
        amount = conn.execute(text("SELECT amount FROM payments")).scalar()
    assert Decimal(str(emi)) == Decimal("2133.33")
    assert Decimal(str(total)) == Decimal("32000")
    assert Decimal(str(amount)) == Decimal("2133.33")
    command.downgrade(cfg, "0001_baseline")


def test_unique_payment_migration_aborts_on_duplicates(tmp_path):
    url, engine, cfg = legacy_db(tmp_path)
    with engine.begin() as conn:
        for _ in range(2):
            conn.execute(text("INSERT INTO payments (loan_id, amount, month_number, payment_date) VALUES (1, 2133.33, 1, '2026-02-10')"))
    with pytest.raises(RuntimeError, match="loan 1 month 1"):
        command.upgrade(cfg, "0003_payment_unique")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM payments")).scalar() == 2


def test_unique_payment_migration_enforces_constraint(tmp_path):
    url, engine, cfg = legacy_db(tmp_path)
    command.upgrade(cfg, "0003_payment_unique")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO payments (loan_id, amount, month_number, payment_date) VALUES (1, 1, 1, '2026-02-10')"))
    with pytest.raises(Exception):
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO payments (loan_id, amount, month_number, payment_date) VALUES (1, 1, 1, '2026-02-10')"))
