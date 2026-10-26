from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from services.timeutil import utcnow_naive

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow_naive)

    profiles = relationship("Profile", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False, default="My Portfolio")
    created_at = Column(DateTime, default=utcnow_naive)

    user = relationship("User", back_populates="profiles")
    borrowers = relationship("Borrower", back_populates="profile", cascade="all, delete-orphan")
    transfers = relationship("Transfer", cascade="all, delete-orphan")


class Borrower(Base):
    __tablename__ = "borrowers"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)

    profile = relationship("Profile", back_populates="borrowers")
    loans = relationship("Loan", back_populates="borrower", cascade="all, delete-orphan")


class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    borrower_id = Column(Integer, ForeignKey("borrowers.id"), nullable=False)
    principal = Column(Numeric(14, 2), nullable=False)
    interest_rate = Column(Numeric(6, 2), default=40)
    total_return = Column(Numeric(14, 2), nullable=False)
    monthly_emi = Column(Numeric(14, 2), nullable=False)
    total_months = Column(Integer, default=10)
    loan_date = Column(Date, nullable=False)
    cycle_start_date = Column(Date, nullable=False)
    status = Column(String, default="active")
    funding_source = Column(String(12), nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)

    borrower = relationship("Borrower", back_populates="loans")
    payments = relationship(
        "Payment", back_populates="loan", cascade="all, delete-orphan",
        order_by="Payment.month_number"
    )


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (UniqueConstraint("loan_id", "month_number", name="uq_payments_loan_month"),)

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    month_number = Column(Integer, nullable=False)
    payment_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)
    method = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)

    loan = relationship("Loan", back_populates="payments")


class Transfer(Base):
    """Money moved between cash in hand and the collection account."""

    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    direction = Column(String(10), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    transfer_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)


class AppConfig(Base):
    __tablename__ = "app_config"

    key = Column(String, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), primary_key=True, default=0)
    value = Column(String, nullable=False)
