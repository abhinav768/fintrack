from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class Borrower(Base):
    __tablename__ = "borrowers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    loans = relationship("Loan", back_populates="borrower", cascade="all, delete-orphan")


class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    borrower_id = Column(Integer, ForeignKey("borrowers.id"), nullable=False)
    principal = Column(Float, nullable=False)
    interest_rate = Column(Float, default=40.0)
    total_return = Column(Float, nullable=False)
    monthly_emi = Column(Float, nullable=False)
    total_months = Column(Integer, default=10)
    loan_date = Column(Date, nullable=False)
    cycle_start_date = Column(Date, nullable=False)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    borrower = relationship("Borrower", back_populates="loans")
    payments = relationship(
        "Payment", back_populates="loan", cascade="all, delete-orphan",
        order_by="Payment.month_number"
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    amount = Column(Float, nullable=False)
    month_number = Column(Integer, nullable=False)
    payment_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    loan = relationship("Loan", back_populates="payments")
