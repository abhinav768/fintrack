"""Switch account balance to opening balance + anchor, preserving each profile's displayed balance.

Old formula: base_balance (default 53600) + total_collected - collections_snapshot.
New formula: balance_opening + payments after anchor - principal lent after anchor.
The old config keys are left in place for downgrade.

Revision ID: 0004_balance_anchor
Revises: 0003_payment_unique
"""
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from alembic import op
import sqlalchemy as sa

revision = "0004_balance_anchor"
down_revision = "0003_payment_unique"
branch_labels = None
depends_on = None

LEGACY_INITIAL_BALANCE = Decimal("53600")


def _config(conn, key, profile_id):
    return conn.execute(
        sa.text("SELECT value FROM app_config WHERE key = :k AND profile_id = :p"),
        {"k": key, "p": profile_id},
    ).scalar()


def _upsert(conn, key, profile_id, value):
    conn.execute(sa.text("DELETE FROM app_config WHERE key = :k AND profile_id = :p"), {"k": key, "p": profile_id})
    conn.execute(
        sa.text("INSERT INTO app_config (key, profile_id, value) VALUES (:k, :p, :v)"),
        {"k": key, "p": profile_id, "v": value},
    )


def upgrade() -> None:
    conn = op.get_bind()
    anchor = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    for (profile_id,) in conn.execute(sa.text("SELECT id FROM profiles")).fetchall():
        base_raw = _config(conn, "base_balance", profile_id)
        snapshot_raw = _config(conn, "collections_snapshot", profile_id)
        base = Decimal(base_raw) if base_raw is not None else LEGACY_INITIAL_BALANCE
        snapshot = Decimal(snapshot_raw) if snapshot_raw is not None else Decimal("0")
        collected = conn.execute(sa.text(
            "SELECT COALESCE(SUM(p.amount), 0) FROM payments p "
            "JOIN loans l ON p.loan_id = l.id JOIN borrowers b ON l.borrower_id = b.id "
            "WHERE b.profile_id = :p"
        ), {"p": profile_id}).scalar()
        current = (base + Decimal(str(collected)) - snapshot).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        _upsert(conn, "balance_opening", profile_id, str(current))
        _upsert(conn, "balance_anchor_at", profile_id, anchor)


def downgrade() -> None:
    op.execute("DELETE FROM app_config WHERE key IN ('balance_opening', 'balance_anchor_at')")
