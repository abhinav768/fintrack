import os
import logging
import httpx
from urllib.parse import quote
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from dateutil.relativedelta import relativedelta
from datetime import date

logger = logging.getLogger("fintrack")

from database import engine, get_db, Base
import models
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finance Tracker")

MONTHLY_INTEREST_RATE = 4  # 4% per month simple interest
DEFAULT_MONTHS = 10


# ── Dashboard ──────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    loans = db.query(models.Loan).all()
    total_principal = sum(l.principal for l in loans)
    total_expected = sum(l.total_return for l in loans)

    total_collected = (
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .scalar()
    )

    active_loans = sum(1 for l in loans if l.status == "active")
    completed_loans = sum(1 for l in loans if l.status == "completed")

    return {
        "total_principal_given": total_principal,
        "total_expected_return": total_expected,
        "total_collected": float(total_collected),
        "total_pending": total_expected - float(total_collected),
        "active_loans": active_loans,
        "completed_loans": completed_loans,
        "total_loans": len(loans),
    }


# ── Account Balance ────────────────────────────────────────────────────────────

INITIAL_BALANCE = 53600.0


def _get_config(db: Session, key: str, default: str = "0") -> str:
    row = db.query(models.AppConfig).filter(models.AppConfig.key == key).first()
    return row.value if row else default


def _set_config(db: Session, key: str, value: str):
    row = db.query(models.AppConfig).filter(models.AppConfig.key == key).first()
    if row:
        row.value = value
    else:
        db.add(models.AppConfig(key=key, value=value))


@app.get("/api/balance")
def get_balance(db: Session = Depends(get_db)):
    base = float(_get_config(db, "base_balance", str(INITIAL_BALANCE)))
    snapshot = float(_get_config(db, "collections_snapshot", "0"))

    total_collected = float(
        db.query(func.coalesce(func.sum(models.Payment.amount), 0)).scalar()
    )
    new_collections = total_collected - snapshot

    return {
        "base_balance": base,
        "new_collections": new_collections,
        "current_balance": base + new_collections,
        "total_collected": total_collected,
    }


@app.put("/api/balance")
def update_base_balance(data: schemas.BalanceUpdate, db: Session = Depends(get_db)):
    total_collected = float(
        db.query(func.coalesce(func.sum(models.Payment.amount), 0)).scalar()
    )
    _set_config(db, "base_balance", str(data.base_balance))
    _set_config(db, "collections_snapshot", str(total_collected))
    db.commit()
    return {"base_balance": data.base_balance, "snapshot": total_collected}


# ── Monthly Collection ────────────────────────────────────────────────────────

@app.get("/api/monthly-collection")
def get_monthly_collection(db: Session = Depends(get_db)):
    today = date.today()
    current_year = today.year
    current_month = today.month

    loans = db.query(models.Loan).all()
    emis_due = []
    expected_total = 0.0
    collected_total = 0.0

    for loan in loans:
        payments_map = {p.month_number: p for p in loan.payments}
        for month_num in range(1, loan.total_months + 1):
            due_date = loan.cycle_start_date + relativedelta(months=month_num - 1)
            if due_date.year == current_year and due_date.month == current_month:
                payment = payments_map.get(month_num)
                paid = payment is not None
                paid_amount = payment.amount if payment else 0
                expected_total += loan.monthly_emi
                if paid:
                    collected_total += paid_amount
                emis_due.append({
                    "loan_id": loan.id,
                    "borrower_name": loan.borrower.name,
                    "month_number": month_num,
                    "emi_amount": loan.monthly_emi,
                    "paid": paid,
                    "paid_amount": paid_amount,
                    "due_date": str(due_date),
                })

    return {
        "month": today.strftime("%B %Y"),
        "expected_total": expected_total,
        "collected_total": collected_total,
        "pending_total": expected_total - collected_total,
        "emis": emis_due,
    }


# ── Borrowers ──────────────────────────────────────────────────────────────────

@app.get("/api/borrowers")
def list_borrowers(db: Session = Depends(get_db)):
    borrowers = db.query(models.Borrower).all()
    result = []
    for b in borrowers:
        active = sum(1 for l in b.loans if l.status == "active")
        result.append({
            "id": b.id,
            "name": b.name,
            "phone": b.phone,
            "active_loans": active,
            "total_loans": len(b.loans),
        })
    return result


@app.post("/api/borrowers")
def create_borrower(borrower: schemas.BorrowerCreate, db: Session = Depends(get_db)):
    db_borrower = models.Borrower(name=borrower.name, phone=borrower.phone)
    db.add(db_borrower)
    db.commit()
    db.refresh(db_borrower)
    return {"id": db_borrower.id, "name": db_borrower.name, "phone": db_borrower.phone}


@app.delete("/api/borrowers/{borrower_id}")
def delete_borrower(borrower_id: int, db: Session = Depends(get_db)):
    borrower = db.query(models.Borrower).filter(models.Borrower.id == borrower_id).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    if any(l.status == "active" for l in borrower.loans):
        raise HTTPException(status_code=400, detail="Cannot delete borrower with active loans")
    db.delete(borrower)
    db.commit()
    return {"message": "Borrower deleted"}


# ── Loans ──────────────────────────────────────────────────────────────────────

@app.get("/api/loans")
def list_loans(db: Session = Depends(get_db)):
    loans = db.query(models.Loan).all()
    result = []
    for loan in loans:
        total_paid = sum(p.amount for p in loan.payments)
        result.append({
            "id": loan.id,
            "borrower_name": loan.borrower.name,
            "borrower_id": loan.borrower_id,
            "principal": loan.principal,
            "total_return": loan.total_return,
            "monthly_emi": loan.monthly_emi,
            "total_months": loan.total_months,
            "loan_date": str(loan.loan_date),
            "cycle_start_date": str(loan.cycle_start_date),
            "status": loan.status,
            "months_paid": len(loan.payments),
            "total_paid": total_paid,
            "remaining": loan.total_return - total_paid,
        })
    return result


@app.post("/api/loans")
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db)):
    borrower = db.query(models.Borrower).filter(
        models.Borrower.id == loan.borrower_id
    ).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")

    months = loan.total_months
    interest_pct = MONTHLY_INTEREST_RATE * months
    total_return = loan.principal * (1 + interest_pct / 100)
    monthly_emi = total_return / months
    cycle_start = loan.loan_date + relativedelta(months=1)

    db_loan = models.Loan(
        borrower_id=loan.borrower_id,
        principal=loan.principal,
        interest_rate=interest_pct,
        total_return=total_return,
        monthly_emi=monthly_emi,
        total_months=months,
        loan_date=loan.loan_date,
        cycle_start_date=cycle_start,
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return {
        "id": db_loan.id,
        "principal": db_loan.principal,
        "total_return": db_loan.total_return,
        "monthly_emi": db_loan.monthly_emi,
        "loan_date": str(db_loan.loan_date),
        "cycle_start_date": str(db_loan.cycle_start_date),
    }


@app.get("/api/loans/{loan_id}")
def get_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    payments_map = {p.month_number: p for p in loan.payments}

    schedule = []
    for month in range(1, loan.total_months + 1):
        payment = payments_map.get(month)
        due_date = loan.cycle_start_date + relativedelta(months=month - 1)
        schedule.append({
            "month_number": month,
            "due_date": str(due_date),
            "expected_amount": loan.monthly_emi,
            "paid": payment is not None,
            "paid_amount": payment.amount if payment else 0,
            "payment_date": str(payment.payment_date) if payment else None,
            "payment_id": payment.id if payment else None,
            "notes": payment.notes if payment else None,
        })

    total_paid = sum(p.amount for p in loan.payments)

    return {
        "id": loan.id,
        "borrower_name": loan.borrower.name,
        "borrower_id": loan.borrower_id,
        "principal": loan.principal,
        "interest_rate": loan.interest_rate,
        "total_return": loan.total_return,
        "monthly_emi": loan.monthly_emi,
        "total_months": loan.total_months,
        "loan_date": str(loan.loan_date),
        "cycle_start_date": str(loan.cycle_start_date),
        "status": loan.status,
        "schedule": schedule,
        "total_paid": total_paid,
        "remaining": loan.total_return - total_paid,
    }


@app.delete("/api/loans/{loan_id}")
def delete_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    db.delete(loan)
    db.commit()
    return {"message": "Loan deleted"}


# ── Payments ───────────────────────────────────────────────────────────────────

@app.post("/api/loans/{loan_id}/payments")
def add_payment(
    loan_id: int, payment: schemas.PaymentCreate, db: Session = Depends(get_db)
):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    existing = (
        db.query(models.Payment)
        .filter(
            models.Payment.loan_id == loan_id,
            models.Payment.month_number == payment.month_number,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Payment already recorded for this month"
        )

    db_payment = models.Payment(
        loan_id=loan_id,
        amount=payment.amount,
        month_number=payment.month_number,
        payment_date=payment.payment_date,
        notes=payment.notes,
    )
    db.add(db_payment)

    paid_count = (
        db.query(models.Payment).filter(models.Payment.loan_id == loan_id).count()
    )
    if paid_count + 1 >= loan.total_months:
        loan.status = "completed"

    db.commit()
    db.refresh(db_payment)
    return {
        "id": db_payment.id,
        "amount": db_payment.amount,
        "month_number": db_payment.month_number,
        "payment_date": str(db_payment.payment_date),
    }


@app.delete("/api/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = (
        db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    loan = db.query(models.Loan).filter(models.Loan.id == payment.loan_id).first()
    db.delete(payment)

    remaining_count = (
        db.query(models.Payment).filter(models.Payment.loan_id == loan.id).count()
    )
    if remaining_count - 1 < loan.total_months:
        loan.status = "active"

    db.commit()
    return {"message": "Payment deleted"}


# ── Notification Settings ─────────────────────────────────────────────────────

@app.get("/api/settings/notifications")
def get_notification_settings(db: Session = Depends(get_db)):
    phone = _get_config(db, "whatsapp_phone", "")
    apikey = _get_config(db, "whatsapp_apikey", "")
    secret = _get_config(db, "notify_secret", "")
    return {
        "whatsapp_phone": phone,
        "whatsapp_apikey": apikey,
        "notify_secret": secret,
        "configured": bool(phone and apikey and secret),
    }


@app.put("/api/settings/notifications")
def update_notification_settings(
    data: schemas.NotificationSettings, db: Session = Depends(get_db)
):
    _set_config(db, "whatsapp_phone", data.whatsapp_phone)
    _set_config(db, "whatsapp_apikey", data.whatsapp_apikey)
    _set_config(db, "notify_secret", data.notify_secret)
    db.commit()
    return {"message": "Settings saved"}


@app.post("/api/notify/test")
def test_notification(db: Session = Depends(get_db)):
    phone = _get_config(db, "whatsapp_phone", "")
    apikey = _get_config(db, "whatsapp_apikey", "")
    if not phone or not apikey:
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    msg = "✅ FinTrack test notification - WhatsApp integration is working!"
    _send_whatsapp(phone, apikey, msg)
    return {"message": "Test notification sent"}


@app.get("/api/notify/daily-reminders")
def send_daily_reminders(token: str = Query(...), db: Session = Depends(get_db)):
    secret = _get_config(db, "notify_secret", "")
    if not secret or token != secret:
        raise HTTPException(status_code=403, detail="Invalid token")

    phone = _get_config(db, "whatsapp_phone", "")
    apikey = _get_config(db, "whatsapp_apikey", "")
    if not phone or not apikey:
        raise HTTPException(status_code=400, detail="WhatsApp not configured")

    today = date.today()
    loans = db.query(models.Loan).filter(models.Loan.status == "active").all()

    due_today = []
    for loan in loans:
        payments_map = {p.month_number: p for p in loan.payments}
        for month_num in range(1, loan.total_months + 1):
            due_date = loan.cycle_start_date + relativedelta(months=month_num - 1)
            if due_date == today and month_num not in payments_map:
                due_today.append({
                    "name": loan.borrower.name,
                    "amount": loan.monthly_emi,
                    "month": month_num,
                })

    if not due_today:
        return {"message": "No EMIs due today", "sent": False}

    total = sum(e["amount"] for e in due_today)
    lines = [f"📋 *FinTrack EMI Reminder*", f"📅 {today.strftime('%d %B %Y')}", ""]
    lines.append(f"*{len(due_today)} EMI(s) to collect today:*")
    lines.append("")
    for e in due_today:
        lines.append(f"• {e['name']} — ₹{e['amount']:,.0f} (Month {e['month']})")
    lines.append("")
    lines.append(f"💰 *Total: ₹{total:,.0f}*")

    msg = "\n".join(lines)
    _send_whatsapp(phone, apikey, msg)
    return {"message": f"Sent reminder for {len(due_today)} EMIs", "sent": True}


def _send_whatsapp(phone: str, apikey: str, message: str):
    url = (
        f"https://api.callmebot.com/whatsapp.php"
        f"?phone={phone}&text={quote(message)}&apikey={apikey}"
    )
    try:
        resp = httpx.get(url, timeout=30)
        logger.info(f"CallMeBot response: {resp.status_code}")
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to send WhatsApp: {e}")


# ── Static frontend ───────────────────────────────────────────────────────────

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
