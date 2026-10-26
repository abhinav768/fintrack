from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from bootstrap_db import alembic_config, bootstrap

LEGACY_SCHEMA = [
    "CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR NOT NULL UNIQUE, password_hash VARCHAR NOT NULL, created_at TIMESTAMP)",
    "CREATE TABLE profiles (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name VARCHAR NOT NULL, created_at TIMESTAMP)",
    "CREATE TABLE borrowers (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, phone VARCHAR, created_at TIMESTAMP, profile_id INTEGER NOT NULL REFERENCES profiles(id))",
    "CREATE TABLE loans (id INTEGER PRIMARY KEY, borrower_id INTEGER NOT NULL REFERENCES borrowers(id), principal FLOAT NOT NULL, interest_rate FLOAT, total_return FLOAT NOT NULL, monthly_emi FLOAT NOT NULL, total_months INTEGER, loan_date DATE NOT NULL, cycle_start_date DATE NOT NULL, status VARCHAR, created_at TIMESTAMP)",
    "CREATE TABLE payments (id INTEGER PRIMARY KEY, loan_id INTEGER NOT NULL REFERENCES loans(id), amount FLOAT NOT NULL, month_number INTEGER NOT NULL, payment_date DATE NOT NULL, notes VARCHAR, created_at TIMESTAMP)",
    "CREATE TABLE app_config (key VARCHAR NOT NULL, value VARCHAR NOT NULL, profile_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (key, profile_id))",
]


def head_revision():
    return ScriptDirectory.from_config(alembic_config()).get_current_head()


def current_revision(engine):
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_fresh_database_gets_full_schema(tmp_path):
    url = f"sqlite:///{tmp_path / 'fresh.db'}"
    bootstrap(url)
    engine = create_engine(url)
    tables = set(inspect(engine).get_table_names())
    assert {"users", "profiles", "borrowers", "loans", "payments", "app_config"} <= tables
    assert current_revision(engine) == head_revision()


def test_legacy_database_is_stamped_and_data_kept(tmp_path):
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
            "VALUES (1, 1, 20000, 60, 32000, 2133.3333333, 15, '2026-01-10', '2026-02-10', 'active')"
        ))
        conn.execute(text("INSERT INTO payments (id, loan_id, amount, month_number, payment_date) VALUES (1, 1, 2133.3333333, 1, '2026-02-10')"))

    bootstrap(url)
    bootstrap(url)  # idempotent on restart

    assert current_revision(engine) == head_revision()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT username FROM users")).scalar() == "abhinav"
        assert conn.execute(text("SELECT COUNT(*) FROM payments")).scalar() == 1
        assert conn.execute(text("SELECT name FROM borrowers")).scalar() == "Ravi"
