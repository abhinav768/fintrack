from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import get_config, profile_loans_query, require_profile, set_config
from services import notify

router = APIRouter(prefix="/api")


@router.get("/settings/notifications")
def get_notification_settings(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    topic = get_config(db, "ntfy_topic", profile.id, "")
    secret = get_config(db, "notify_secret", profile.id, "")
    return {
        "ntfy_topic": topic,
        "ntfy_topic_2": get_config(db, "ntfy_topic_2", profile.id, ""),
        "notify_secret": secret,
        "configured": bool(topic and secret),
    }


@router.put("/settings/notifications")
def update_notification_settings(
    data: schemas.NotificationSettings,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    set_config(db, "ntfy_topic", profile.id, data.ntfy_topic)
    set_config(db, "ntfy_topic_2", profile.id, data.ntfy_topic_2 or "")
    set_config(db, "notify_secret", profile.id, data.notify_secret)
    db.commit()
    return {"message": "Settings saved"}


@router.post("/notify/test")
def test_notification(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    topic = get_config(db, "ntfy_topic", profile.id, "")
    if not topic:
        raise HTTPException(status_code=400, detail="ntfy topic not configured")
    notify.send_ntfy(topic, "FinTrack Test", "Push notifications are working!")
    topic_2 = get_config(db, "ntfy_topic_2", profile.id, "")
    if topic_2:
        notify.send_ntfy(topic_2, "FinTrack Test", "Push notifications are working!")
    return {"message": "Test notification sent"}


@router.get("/notify/daily-reminders")
def send_daily_reminders(token: str = Query(...), db: Session = Depends(get_db)):
    """Cron endpoint: iterates all profiles, sends reminders where token matches."""
    total_sent = 0
    for p in db.query(models.Profile).all():
        secret = get_config(db, "notify_secret", p.id, "")
        if not secret or token != secret:
            continue
        topic = get_config(db, "ntfy_topic", p.id, "")
        if not topic:
            continue

        today = date.today()
        loans = profile_loans_query(db, p.id).filter(models.Loan.status == "active").all()
        due_today = []
        for loan in loans:
            payments_map = {pm.month_number: pm for pm in loan.payments}
            for month_num in range(1, loan.total_months + 1):
                due_date = loan.cycle_start_date + relativedelta(months=month_num - 1)
                if due_date == today and month_num not in payments_map:
                    due_today.append({"name": loan.borrower.name, "amount": loan.monthly_emi, "month": month_num})

        if not due_today:
            continue

        total = sum(e["amount"] for e in due_today)
        lines = [f"- {e['name']}: Rs {e['amount']:,.0f} (Month {e['month']})" for e in due_today]
        lines.append(f"\nTotal: Rs {total:,.0f}")
        title = f"EMI Reminder - {today.strftime('%d %B %Y')}"
        body = f"{len(due_today)} EMI(s) to collect today:\n" + "\n".join(lines)
        notify.send_ntfy(topic, title, body)
        topic_2 = get_config(db, "ntfy_topic_2", p.id, "")
        if topic_2:
            notify.send_ntfy(topic_2, title, body)
        total_sent += len(due_today)

    if total_sent == 0:
        return {"message": "No EMIs due today", "sent": False}
    return {"message": f"Sent reminders for {total_sent} EMIs", "sent": True}
