"""Baseline: schema as it existed before Alembic was introduced.

Production databases that already have these tables are stamped at this
revision by bootstrap_db.py instead of running it.

Revision ID: 0001_baseline
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("username", sa.String, nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_table(
        "borrowers",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("profile_id", sa.Integer, sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("phone", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_table(
        "loans",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("borrower_id", sa.Integer, sa.ForeignKey("borrowers.id"), nullable=False),
        sa.Column("principal", sa.Float, nullable=False),
        sa.Column("interest_rate", sa.Float),
        sa.Column("total_return", sa.Float, nullable=False),
        sa.Column("monthly_emi", sa.Float, nullable=False),
        sa.Column("total_months", sa.Integer),
        sa.Column("loan_date", sa.Date, nullable=False),
        sa.Column("cycle_start_date", sa.Date, nullable=False),
        sa.Column("status", sa.String),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("loan_id", sa.Integer, sa.ForeignKey("loans.id"), nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("month_number", sa.Integer, nullable=False),
        sa.Column("payment_date", sa.Date, nullable=False),
        sa.Column("notes", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_table(
        "app_config",
        sa.Column("key", sa.String, primary_key=True),
        sa.Column("profile_id", sa.Integer, sa.ForeignKey("profiles.id"), primary_key=True),
        sa.Column("value", sa.String, nullable=False),
    )


def downgrade() -> None:
    for table in ("app_config", "payments", "loans", "borrowers", "profiles", "users"):
        op.drop_table(table)
