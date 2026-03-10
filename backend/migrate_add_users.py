"""
One-time migration: add users table, assign existing data to a default user.
Usage: DATABASE_URL=<your_neon_url> python3 migrate_add_users.py
"""

import os
import sys
import psycopg2
from passlib.context import CryptContext

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: Set DATABASE_URL environment variable")
    sys.exit(1)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_USERNAME = "abhinav"
DEFAULT_PASSWORD = "change-me-now"
DEFAULT_PORTFOLIO = "Abhinav's Portfolio"

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor()

try:
    # 1. Create users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR NOT NULL UNIQUE,
            password_hash VARCHAR NOT NULL,
            portfolio_name VARCHAR NOT NULL DEFAULT 'My Portfolio',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    print("Created users table")

    # 2. Insert default user (skip if already exists)
    cur.execute("SELECT id FROM users WHERE username = %s", (DEFAULT_USERNAME,))
    row = cur.fetchone()
    if row:
        default_user_id = row[0]
        print(f"Default user '{DEFAULT_USERNAME}' already exists (id={default_user_id})")
    else:
        hashed = pwd_context.hash(DEFAULT_PASSWORD)
        cur.execute(
            "INSERT INTO users (username, password_hash, portfolio_name) VALUES (%s, %s, %s) RETURNING id",
            (DEFAULT_USERNAME, hashed, DEFAULT_PORTFOLIO),
        )
        default_user_id = cur.fetchone()[0]
        print(f"Created default user '{DEFAULT_USERNAME}' (id={default_user_id})")
        print(f"  TEMPORARY password: {DEFAULT_PASSWORD}")
        print("  >> Change it after first login! <<")

    # 3. Add user_id column to borrowers (if not exists)
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'borrowers' AND column_name = 'user_id'
    """)
    if not cur.fetchone():
        cur.execute("ALTER TABLE borrowers ADD COLUMN user_id INTEGER")
        cur.execute("UPDATE borrowers SET user_id = %s", (default_user_id,))
        cur.execute("ALTER TABLE borrowers ALTER COLUMN user_id SET NOT NULL")
        cur.execute("""
            ALTER TABLE borrowers
            ADD CONSTRAINT fk_borrowers_user_id FOREIGN KEY (user_id) REFERENCES users(id)
        """)
        print(f"Added user_id to borrowers, assigned all rows to user {default_user_id}")
    else:
        print("borrowers.user_id already exists, skipping")

    # 4. Alter app_config to add user_id (if not exists)
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'app_config' AND column_name = 'user_id'
    """)
    if not cur.fetchone():
        # Drop old PK, add user_id, set composite PK
        cur.execute("ALTER TABLE app_config DROP CONSTRAINT IF EXISTS app_config_pkey")
        cur.execute("ALTER TABLE app_config ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE app_config ADD PRIMARY KEY (key, user_id)")
        # Update existing config rows to belong to the default user
        cur.execute("UPDATE app_config SET user_id = %s", (default_user_id,))
        print(f"Added user_id to app_config, assigned all rows to user {default_user_id}")
    else:
        print("app_config.user_id already exists, skipping")

    conn.commit()
    print("\nMigration complete!")

except Exception as e:
    conn.rollback()
    print(f"\nMigration FAILED, rolled back: {e}")
    sys.exit(1)

finally:
    cur.close()
    conn.close()
