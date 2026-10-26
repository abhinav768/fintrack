"""One payment record per loan month, enforced by the database.

Aborts (without touching data) if duplicates already exist so they can be
resolved by hand.

Revision ID: 0003_payment_unique
Revises: 0002_numeric_money
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_payment_unique"
down_revision = "0002_numeric_money"
branch_labels = None
depends_on = None


def upgrade() -> None:
    duplicates = op.get_bind().execute(sa.text(
        "SELECT loan_id, month_number, COUNT(*) FROM payments "
        "GROUP BY loan_id, month_number HAVING COUNT(*) > 1"
    )).fetchall()
    if duplicates:
        listing = ", ".join(f"loan {r[0]} month {r[1]} ({r[2]}x)" for r in duplicates)
        raise RuntimeError(f"Duplicate payments must be resolved before migrating: {listing}")
    with op.batch_alter_table("payments") as batch:
        batch.create_unique_constraint("uq_payments_loan_month", ["loan_id", "month_number"])


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch:
        batch.drop_constraint("uq_payments_loan_month", type_="unique")
