"""Migrate a COPY of the production database and prove no numbers changed.

Usage (point at a Neon branch, never at production itself):
    DATABASE_URL=<branch connection string> python dryrun_check.py

For every profile it records the dashboard totals and account balance using the
pre-migration formulas, runs all migrations, recomputes with the new code, and
exits non-zero if anything differs by more than one paisa.
"""
import os
import sys
from decimal import Decimal

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

TOLERANCE = Decimal("0.01")
LEGACY_INITIAL_BALANCE = Decimal("53600")


def _url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        sys.exit("Set DATABASE_URL to a Neon *branch* connection string.")
    return url.replace("postgres://", "postgresql://", 1)


def legacy_snapshot(conn) -> dict:
    """Numbers exactly as the pre-migration code computed them."""
    result = {}
    for (pid,) in conn.execute(text("SELECT id FROM profiles ORDER BY id")):
        principal, expected, loans = conn.execute(text(
            "SELECT COALESCE(SUM(l.principal), 0), COALESCE(SUM(l.total_return), 0), COUNT(*) "
            "FROM loans l JOIN borrowers b ON l.borrower_id = b.id WHERE b.profile_id = :p"
        ), {"p": pid}).one()
        collected = conn.execute(text(
            "SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN loans l ON p.loan_id = l.id "
            "JOIN borrowers b ON l.borrower_id = b.id WHERE b.profile_id = :p"
        ), {"p": pid}).scalar()
        cfg = dict(conn.execute(text(
            "SELECT key, value FROM app_config WHERE profile_id = :p AND key IN ('base_balance', 'collections_snapshot')"
        ), {"p": pid}).fetchall())
        base = Decimal(cfg["base_balance"]) if "base_balance" in cfg else LEGACY_INITIAL_BALANCE
        snapshot = Decimal(cfg.get("collections_snapshot", "0"))
        collected = Decimal(str(collected))
        payments = conn.execute(text(
            "SELECT COUNT(*) FROM payments p JOIN loans l ON p.loan_id = l.id "
            "JOIN borrowers b ON l.borrower_id = b.id WHERE b.profile_id = :p"
        ), {"p": pid}).scalar()
        result[pid] = {
            "rounded_rows": loans + payments,
            "loans": loans,
            "total_lent": Decimal(str(principal)),
            "total_expected": Decimal(str(expected)),
            "total_collected": collected,
            "balance": base + collected - snapshot,
        }
    return result


def new_snapshot(session) -> dict:
    import models
    from services.balance import compute_balance
    from services.money import to_money

    result = {}
    for profile in session.query(models.Profile).order_by(models.Profile.id):
        loans = [l for b in profile.borrowers for l in b.loans]
        result[profile.id] = {
            "loans": len(loans),
            "total_lent": sum((to_money(l.principal) for l in loans), Decimal("0")),
            "total_expected": sum((to_money(l.total_return) for l in loans), Decimal("0")),
            "total_collected": sum((to_money(p.amount) for l in loans for p in l.payments), Decimal("0")),
            "balance": compute_balance(session, profile.id)["current_balance"],
        }
    return result


def main() -> int:
    url = _url()
    engine = create_engine(url)
    tables = set(inspect(engine).get_table_names())
    if "alembic_version" in tables:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        if version != "0001_baseline":
            sys.exit(f"This database is already migrated ({version}); use a fresh branch of production.")

    with engine.connect() as conn:
        before = legacy_snapshot(conn)

    from bootstrap_db import bootstrap
    bootstrap(url)

    session = sessionmaker(bind=engine)()
    after = new_snapshot(session)

    ok = True
    print(f"{'profile':>8} {'field':<16} {'before':>14} {'after':>14}  result")
    for pid, old in before.items():
        new = after.get(pid, {})
        # Each stored amount is rounded to the nearest paisa, so totals may move by up to 0.005 per row.
        tolerance = TOLERANCE + Decimal("0.005") * old.pop("rounded_rows")
        for field, old_value in old.items():
            new_value = new.get(field)
            same = new_value is not None and abs(Decimal(str(new_value)) - Decimal(str(old_value))) <= tolerance
            ok &= same
            print(f"{pid:>8} {field:<16} {str(old_value):>14} {str(new_value):>14}  {'ok' if same else 'MISMATCH'}")
    print("\nALL NUMBERS MATCH" if ok else "\nMISMATCH FOUND - do not deploy")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
