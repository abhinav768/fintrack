from fastapi import HTTPException
from sqlalchemy.orm import Query, Session

import models


def require_profile(profile_id: int, user: models.User, db: Session) -> models.Profile:
    """Validate that profile_id belongs to the authenticated user."""
    profile = (
        db.query(models.Profile)
        .filter(models.Profile.id == profile_id, models.Profile.user_id == user.id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


def profile_loans_query(db: Session, profile_id: int) -> Query:
    return (
        db.query(models.Loan)
        .join(models.Borrower)
        .filter(models.Borrower.profile_id == profile_id)
    )


def get_profile_loan(db: Session, loan_id: int, profile: models.Profile) -> models.Loan:
    loan = profile_loans_query(db, profile.id).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


def get_profile_borrower(db: Session, borrower_id: int, profile: models.Profile) -> models.Borrower:
    borrower = (
        db.query(models.Borrower)
        .filter(models.Borrower.id == borrower_id, models.Borrower.profile_id == profile.id)
        .first()
    )
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    return borrower


def get_config(db: Session, key: str, profile_id: int, default: str = "0") -> str:
    row = (
        db.query(models.AppConfig)
        .filter(models.AppConfig.key == key, models.AppConfig.profile_id == profile_id)
        .first()
    )
    return row.value if row else default


def set_config(db: Session, key: str, profile_id: int, value: str) -> None:
    row = (
        db.query(models.AppConfig)
        .filter(models.AppConfig.key == key, models.AppConfig.profile_id == profile_id)
        .first()
    )
    if row:
        row.value = value
    else:
        db.add(models.AppConfig(key=key, profile_id=profile_id, value=value))
