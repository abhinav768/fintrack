import logging
import os
from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import require_profile
from ratelimit import limiter, user_or_ip

logger = logging.getLogger("fintrack")
router = APIRouter(prefix="/api")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


def build_profile_context(db: Session, profile: models.Profile) -> str:
    """Build a detailed text summary of the profile's financial data."""
    today = date.today()
    borrowers = db.query(models.Borrower).filter(models.Borrower.profile_id == profile.id).all()

    lines = [f"Profile: {profile.name}", f"Today: {today}", ""]
    if not borrowers:
        lines.append("No borrowers or loans yet.")
        return "\n".join(lines)

    all_loans = []
    monthly_schedule = {}
    overdue_emis = []

    lines.append("BORROWERS & LOANS:")
    for b in borrowers:
        for loan in b.loans:
            all_loans.append(loan)
            total_paid = sum(p.amount for p in loan.payments)
            remaining = loan.total_return - total_paid
            payments_map = {p.month_number: p for p in loan.payments}
            lines.append(
                f"- {b.name}: principal Rs {int(loan.principal)}, "
                f"total return Rs {int(loan.total_return)}, "
                f"EMI Rs {int(loan.monthly_emi)}/month, "
                f"{loan.total_months} months, status={loan.status}, "
                f"paid {len(loan.payments)}/{loan.total_months} months (Rs {int(total_paid)}), "
                f"remaining Rs {int(remaining)}"
            )
            for m in range(1, loan.total_months + 1):
                due_date = loan.cycle_start_date + relativedelta(months=m - 1)
                paid = m in payments_map
                monthly_schedule.setdefault((due_date.year, due_date.month), []).append({
                    "borrower": b.name,
                    "emi": int(loan.monthly_emi),
                    "due_date": str(due_date),
                    "due_day": due_date.day,
                    "paid": paid,
                })
                if not paid and due_date < today.replace(day=1):
                    overdue_emis.append({"borrower": b.name, "emi": int(loan.monthly_emi), "due_date": str(due_date)})

    lines.append("")
    lines.append("MONTH-BY-MONTH EMI SCHEDULE:")
    for key in sorted(monthly_schedule):
        entries = monthly_schedule[key]
        month_label = date(key[0], key[1], 1).strftime("%B %Y")
        tag = " (CURRENT MONTH)" if key == (today.year, today.month) else ""
        month_total = sum(e["emi"] for e in entries)
        month_collected = sum(e["emi"] for e in entries if e["paid"])
        lines.append(f"  {month_label}{tag}:")
        for e in sorted(entries, key=lambda x: x["due_day"]):
            status = "COLLECTED" if e["paid"] else "PENDING"
            lines.append(f"    {e['borrower']}: Rs {e['emi']} due {e['due_date']} [{status}]")
        lines.append(
            f"    Total: {len(entries)} EMIs, expected Rs {month_total}, "
            f"collected Rs {month_collected}, pending Rs {month_total - month_collected}"
        )

    if overdue_emis:
        lines.append("")
        lines.append("OVERDUE EMIs (past months, unpaid):")
        for e in overdue_emis:
            lines.append(f"  - {e['borrower']}: Rs {e['emi']} was due on {e['due_date']}")
        lines.append(f"  TOTAL OVERDUE: {len(overdue_emis)} EMIs, Rs {sum(e['emi'] for e in overdue_emis)}")

    total_principal = sum(l.principal for l in all_loans)
    total_expected = sum(l.total_return for l in all_loans)
    total_collected = sum(sum(p.amount for p in l.payments) for l in all_loans)
    active = sum(1 for l in all_loans if l.status == "active")
    profit = int(total_collected - total_principal) if total_collected > total_principal else 0

    lines.append("")
    lines.append(
        f"OVERALL SUMMARY: {len(all_loans)} loans ({active} active), "
        f"total principal Rs {int(total_principal)}, "
        f"total expected Rs {int(total_expected)}, "
        f"total collected Rs {int(total_collected)}, "
        f"total pending Rs {int(total_expected - total_collected)}, "
        f"total profit earned Rs {profit}"
    )
    return "\n".join(lines)


def generate_reply(prompt: str) -> str:
    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={"temperature": 0.3, "max_output_tokens": 2048},
    )
    return response.text or "I couldn't generate a response. Please try again."


@router.post("/chat")
@limiter.limit("20/hour", key_func=user_or_ip)
def chat(
    request: Request,
    data: schemas.ChatMessage,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured. Add GEMINI_API_KEY environment variable.")

    profile = require_profile(profile_id, user, db)
    context = build_profile_context(db, profile)
    system_prompt = (
        "You are FinTrack AI, a helpful assistant for a personal lending/finance tracker app. "
        "The user manages loans they give to borrowers and collects monthly EMIs. "
        "Answer questions based ONLY on the data provided below. "
        "Be concise, friendly, and use Indian Rupee (Rs) formatting. "
        "IMPORTANT: Always write amounts as full numbers (e.g. Rs 35000, not Rs 35,00 or Rs 35K). "
        "Use the MONTH-BY-MONTH EMI SCHEDULE to answer questions about any specific month (past, current, or future). "
        "Always give COMPLETE answers - if asked for top 5, list all 5. Never stop mid-list. "
        "If the data doesn't contain the answer, say so honestly. "
        "Do NOT make up numbers.\n\n"
        f"--- DATA ---\n{context}\n--- END DATA ---"
    )

    try:
        reply = generate_reply(f"{system_prompt}\n\nUser question: {data.message}")
    except Exception:
        logger.exception("Gemini API error")
        raise HTTPException(status_code=502, detail="The AI assistant is temporarily unavailable. Please try again.")

    logger.info("AI chat: profile=%d, question=%s", profile.id, data.message[:80],
                extra={"extra_fields": {
                    "event_type": "ai_chat", "profile_id": profile.id,
                    "question": data.message[:200],
                }})
    return {"reply": reply}
