"""
One-time migration: convert user-based scoping to profile-based scoping.

Creates `profiles` table, migrates each user's portfolio_name into a profile,
re-points borrowers.user_id -> borrowers.profile_id and
app_config.user_id -> app_config.profile_id.

Usage: DATABASE_URL=<your_neon_url> python3 migrate_add_profiles.py
"""

import os
import sys
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: Set DATABASE_URL environment variable")
    sys.exit(1)

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor()

try:
    # ── 1. Create profiles table ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name VARCHAR NOT NULL DEFAULT 'My Portfolio',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    print("1. Created profiles table (or already exists)")

    # ── 2. Populate profiles from users.portfolio_name ────────────────────────
    cur.execute("SELECT COUNT(*) FROM profiles")
    existing_profiles = cur.fetchone()[0]

    if existing_profiles == 0:
        cur.execute("SELECT id, username, portfolio_name FROM users")
        users = cur.fetchall()
        for user_id, username, portfolio_name in users:
            name = portfolio_name or f"{username}'s Portfolio"
            cur.execute(
                "INSERT INTO profiles (user_id, name) VALUES (%s, %s) RETURNING id",
                (user_id, name),
            )
            profile_id = cur.fetchone()[0]
            print(f"   Created profile '{name}' (id={profile_id}) for user {username} (id={user_id})")
    else:
        print(f"   Profiles table already has {existing_profiles} rows, skipping population")

    # Build a user_id -> profile_id mapping for the data migration
    cur.execute("SELECT user_id, id FROM profiles")
    user_to_profile = {}
    for uid, pid in cur.fetchall():
        if uid not in user_to_profile:
            user_to_profile[uid] = pid

    print(f"   User->Profile mapping: {user_to_profile}")

    # ── 3. Migrate borrowers: user_id -> profile_id ───────────────────────────
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'borrowers' AND column_name = 'profile_id'
    """)
    if not cur.fetchone():
        cur.execute("ALTER TABLE borrowers ADD COLUMN profile_id INTEGER")

        for uid, pid in user_to_profile.items():
            cur.execute(
                "UPDATE borrowers SET profile_id = %s WHERE user_id = %s",
                (pid, uid),
            )

        cur.execute("ALTER TABLE borrowers ALTER COLUMN profile_id SET NOT NULL")
        cur.execute("""
            ALTER TABLE borrowers
            ADD CONSTRAINT fk_borrowers_profile_id FOREIGN KEY (profile_id) REFERENCES profiles(id)
        """)

        cur.execute("ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS fk_borrowers_user_id")
        cur.execute("ALTER TABLE borrowers DROP COLUMN IF EXISTS user_id")

        print("3. Migrated borrowers.user_id -> borrowers.profile_id")
    else:
        print("3. borrowers.profile_id already exists, skipping")

    # ── 4. Migrate app_config: user_id -> profile_id ──────────────────────────
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'app_config' AND column_name = 'profile_id'
    """)
    if not cur.fetchone():
        cur.execute("ALTER TABLE app_config DROP CONSTRAINT IF EXISTS app_config_pkey")
        cur.execute("ALTER TABLE app_config ADD COLUMN profile_id INTEGER NOT NULL DEFAULT 0")

        for uid, pid in user_to_profile.items():
            cur.execute(
                "UPDATE app_config SET profile_id = %s WHERE user_id = %s",
                (pid, uid),
            )

        cur.execute("ALTER TABLE app_config ADD PRIMARY KEY (key, profile_id)")
        cur.execute("ALTER TABLE app_config DROP COLUMN IF EXISTS user_id")

        print("4. Migrated app_config.user_id -> app_config.profile_id")
    else:
        print("4. app_config.profile_id already exists, skipping")

    # ── 5. Drop portfolio_name from users ─────────────────────────────────────
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'portfolio_name'
    """)
    if cur.fetchone():
        cur.execute("ALTER TABLE users DROP COLUMN portfolio_name")
        print("5. Dropped users.portfolio_name")
    else:
        print("5. users.portfolio_name already gone, skipping")

    conn.commit()
    print("\nMigration complete!")

except Exception as e:
    conn.rollback()
    print(f"\nMigration FAILED, rolled back: {e}")
    sys.exit(1)

finally:
    cur.close()
    conn.close()
