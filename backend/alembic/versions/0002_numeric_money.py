"""Store money as exact decimals instead of floats (values rounded to paise in place).

Revision ID: 0002_numeric_money
Revises: 0001_baseline
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_numeric_money"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

COLUMNS = {
    "loans": [
        ("principal", sa.Numeric(14, 2), False),
        ("interest_rate", sa.Numeric(6, 2), True),
        ("total_return", sa.Numeric(14, 2), False),
        ("monthly_emi", sa.Numeric(14, 2), False),
    ],
    "payments": [("amount", sa.Numeric(14, 2), False)],
}


def upgrade() -> None:
    for table, cols in COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            for name, new_type, nullable in cols:
                batch.alter_column(
                    name,
                    existing_type=sa.Float(),
                    type_=new_type,
                    existing_nullable=nullable,
                    postgresql_using=f"round({name}::numeric, 2)",
                )
        for name, _, _ in cols:
            op.execute(f"UPDATE {table} SET {name} = round({name}, 2)")


def downgrade() -> None:
    for table, cols in COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            for name, new_type, nullable in cols:
                batch.alter_column(
                    name,
                    existing_type=new_type,
                    type_=sa.Float(),
                    existing_nullable=nullable,
                    postgresql_using=f"{name}::double precision",
                )
