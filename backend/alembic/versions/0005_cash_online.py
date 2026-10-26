"""Record how each EMI was paid, where each loan's money came from, and cash/bank transfers.

Existing payments become 'online' and existing loans 'collection', which keeps every
collection-account balance exactly as before. The columns stay nullable because the
previous release keeps serving (and writing) until the new one is healthy; the app
reads NULL as the old behaviour.

Revision ID: 0005_cash_online
Revises: 0004_balance_anchor
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_cash_online"
down_revision = "0004_balance_anchor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("payments") as batch:
        batch.add_column(sa.Column("method", sa.String(10), nullable=True))
    with op.batch_alter_table("loans") as batch:
        batch.add_column(sa.Column("funding_source", sa.String(12), nullable=True))
    op.execute("UPDATE payments SET method = 'online' WHERE method IS NULL")
    op.execute("UPDATE loans SET funding_source = 'collection' WHERE funding_source IS NULL")

    op.create_table(
        "transfers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("profile_id", sa.Integer, sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("transfer_date", sa.Date, nullable=False),
        sa.Column("notes", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_transfers_id", "transfers", ["id"])
    op.create_index("ix_transfers_profile_id", "transfers", ["profile_id"])


def downgrade() -> None:
    op.drop_index("ix_transfers_profile_id", table_name="transfers")
    op.drop_index("ix_transfers_id", table_name="transfers")
    op.drop_table("transfers")
    with op.batch_alter_table("loans") as batch:
        batch.drop_column("funding_source")
    with op.batch_alter_table("payments") as batch:
        batch.drop_column("method")
