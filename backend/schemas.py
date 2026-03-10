from pydantic import BaseModel
from datetime import date
from typing import Optional

# YQ4XSQHKNSXSQMKRHFERLBS3

class BorrowerCreate(BaseModel):
    name: str
    phone: Optional[str] = None


class LoanCreate(BaseModel):
    borrower_id: int
    principal: float
    loan_date: date
    total_months: int = 10


class PaymentCreate(BaseModel):
    amount: float
    month_number: int
    payment_date: date
    notes: Optional[str] = None


class BalanceUpdate(BaseModel):
    base_balance: float


class NotificationSettings(BaseModel):
    ntfy_topic: str
    ntfy_topic_2: Optional[str] = ""
    notify_secret: str
