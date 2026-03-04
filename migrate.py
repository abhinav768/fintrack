"""
One-time migration: copy data from local SQLite to Neon PostgreSQL.
Usage: python3 migrate.py
"""

import sqlite3
import psycopg2
import os
import sys

NEON_URL = os.environ.get("DATABASE_URL")
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "finance.db")

if not NEON_URL:
    print("ERROR: Set DATABASE_URL environment variable to your Neon connection string")
    sys.exit(1)

if not os.path.exists(SQLITE_PATH):
    print(f"ERROR: SQLite database not found at {SQLITE_PATH}")
    sys.exit(1)

sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row
src = sqlite_conn.cursor()

pg_conn = psycopg2.connect(NEON_URL)
pg_conn.autocommit = False
dst = pg_conn.cursor()

try:
    # Create tables if they don't exist (matching SQLAlchemy models)
    dst.execute("""
        CREATE TABLE IF NOT EXISTS borrowers (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            phone VARCHAR,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    dst.execute("""
        CREATE TABLE IF NOT EXISTS loans (
            id SERIAL PRIMARY KEY,
            borrower_id INTEGER NOT NULL REFERENCES borrowers(id),
            principal FLOAT NOT NULL,
            interest_rate FLOAT DEFAULT 40.0,
            total_return FLOAT NOT NULL,
            monthly_emi FLOAT NOT NULL,
            total_months INTEGER DEFAULT 10,
            loan_date DATE NOT NULL,
            cycle_start_date DATE NOT NULL,
            status VARCHAR DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    dst.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            loan_id INTEGER NOT NULL REFERENCES loans(id),
            amount FLOAT NOT NULL,
            month_number INTEGER NOT NULL,
            payment_date DATE NOT NULL,
            notes VARCHAR,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Clear existing data (in case of re-run)
    dst.execute("DELETE FROM payments")
    dst.execute("DELETE FROM loans")
    dst.execute("DELETE FROM borrowers")

    # Migrate borrowers
    src.execute("SELECT id, name, phone, created_at FROM borrowers ORDER BY id")
    borrowers = src.fetchall()
    for b in borrowers:
        dst.execute(
            "INSERT INTO borrowers (id, name, phone, created_at) VALUES (%s, %s, %s, %s)",
            (b["id"], b["name"], b["phone"], b["created_at"])
        )
    print(f"Migrated {len(borrowers)} borrowers")

    # Migrate loans
    src.execute("""SELECT id, borrower_id, principal, interest_rate, total_return,
                   monthly_emi, total_months, loan_date, cycle_start_date, status, created_at
                   FROM loans ORDER BY id""")
    loans = src.fetchall()
    for l in loans:
        dst.execute(
            """INSERT INTO loans (id, borrower_id, principal, interest_rate, total_return,
               monthly_emi, total_months, loan_date, cycle_start_date, status, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (l["id"], l["borrower_id"], l["principal"], l["interest_rate"],
             l["total_return"], l["monthly_emi"], l["total_months"],
             l["loan_date"], l["cycle_start_date"], l["status"], l["created_at"])
        )
    print(f"Migrated {len(loans)} loans")

    # Migrate payments
    src.execute("""SELECT id, loan_id, amount, month_number, payment_date, notes, created_at
                   FROM payments ORDER BY id""")
    payments = src.fetchall()
    for p in payments:
        dst.execute(
            """INSERT INTO payments (id, loan_id, amount, month_number, payment_date, notes, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (p["id"], p["loan_id"], p["amount"], p["month_number"],
             p["payment_date"], p["notes"], p["created_at"])
        )
    print(f"Migrated {len(payments)} payments")

    # Reset sequences so new inserts get correct IDs
    dst.execute("SELECT setval('borrowers_id_seq', (SELECT COALESCE(MAX(id),0) FROM borrowers))")
    dst.execute("SELECT setval('loans_id_seq', (SELECT COALESCE(MAX(id),0) FROM loans))")
    dst.execute("SELECT setval('payments_id_seq', (SELECT COALESCE(MAX(id),0) FROM payments))")

    pg_conn.commit()
    print("\nMigration complete!")

except Exception as e:
    pg_conn.rollback()
    print(f"\nMigration FAILED, rolled back: {e}")
    sys.exit(1)

finally:
    sqlite_conn.close()
    pg_conn.close()
