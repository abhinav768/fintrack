import re
from datetime import date
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, field_validator

from services.money import to_money

MAX_AMOUNT = 1_000_000_000

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]
Notes = Annotated[str, StringConstraints(max_length=500)]

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")


class BorrowerCreate(BaseModel):
    name: Name
    phone: Optional[Phone] = None


class BorrowerUpdate(BaseModel):
    name: Name
    phone: Optional[Phone] = None


Amount = Annotated[Decimal, Field(gt=0, le=MAX_AMOUNT), AfterValidator(to_money)]
MonthlyRate = Annotated[Decimal, Field(ge=0, le=20), AfterValidator(to_money)]
Months = Annotated[int, Field(ge=1, le=120)]


class LoanCreate(BaseModel):
    borrower_id: int
    principal: Amount
    loan_date: date
    total_months: Months = 10
    monthly_rate: MonthlyRate = Decimal("4")


class LoanUpdate(BaseModel):
    borrower_id: Optional[int] = None
    principal: Optional[Amount] = None
    loan_date: Optional[date] = None
    total_months: Optional[Months] = None
    monthly_rate: Optional[MonthlyRate] = None


class PaymentCreate(BaseModel):
    amount: Amount
    month_number: int = Field(ge=1)
    payment_date: date
    notes: Optional[Notes] = None


class PaymentUpdate(BaseModel):
    amount: Optional[Amount] = None
    payment_date: Optional[date] = None
    notes: Optional[Notes] = None


class BalanceUpdate(BaseModel):
    base_balance: Annotated[Decimal, Field(ge=-MAX_AMOUNT, le=MAX_AMOUNT), AfterValidator(to_money)]


Topic = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9_-]{1,64}$")]


class NotificationSettings(BaseModel):
    ntfy_topic: Topic
    ntfy_topic_2: Optional[Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^([A-Za-z0-9_-]{1,64})?$")]] = ""
    notify_secret: Annotated[str, StringConstraints(strip_whitespace=True, min_length=16, max_length=128)]


class UserSignup(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-32 characters: letters, numbers, dot, underscore or dash")
        return v


class UserLogin(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=128)


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ProfileCreate(BaseModel):
    name: Name


class ProfileUpdate(BaseModel):
    name: Name


class ChatMessage(BaseModel):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
