from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from helpers import create_loan
from services import timeutil
from services.loan_terms import compute_loan_terms


@pytest.fixture
def freeze_today(monkeypatch):
    def _freeze(d: date):
        monkeypatch.setattr(timeutil, "today", lambda at=None: d)
    return _freeze


def pay(api, loan_id, month, amount, on="2026-02-15", **extra):
    return api.post(
        f"/api/loans/{loan_id}/payments",
        json={"amount": amount, "month_number": month, "payment_date": on, **extra},
    )


# ── Loan terms ────────────────────────────────────────────────────────────────

def test_terms_readme_examples():
    t = compute_loan_terms(10000, 4, 10)
    assert (t.interest_pct, t.total_return, t.monthly_emi, t.last_emi) == (
        Decimal("40.00"), Decimal("14000.00"), Decimal("1400.00"), Decimal("1400.00"))
    t = compute_loan_terms(20000, 4, 15)
    assert t.total_return == Decimal("32000.00")
    assert t.monthly_emi == Decimal("2133.33")
    assert t.last_emi == Decimal("2133.38")
    assert t.monthly_emi * 14 + t.last_emi == t.total_return


def test_terms_custom_rate():
    t = compute_loan_terms(10000, Decimal("3.5"), 12)
    assert t.interest_pct == Decimal("42.00")
    assert t.total_return == Decimal("14200.00")


def test_create_loan_with_custom_rate(api):
    loan_id = create_loan(api, principal=10000, months=12, monthly_rate=3.5)
    loan = api.get(f"/api/loans/{loan_id}").json()
    assert loan["total_return"] == 14200
    assert loan["monthly_rate"] == 3.5
    assert loan["interest_rate"] == 42


def test_preview_endpoint(api):
    r = api.get("/api/loans/preview", params={"principal": 20000, "monthly_rate": 4, "months": 15})
    assert r.status_code == 200
    assert r.json() == {"interest_pct": 60, "total_return": 32000, "monthly_emi": 2133.33, "last_emi": 2133.38}


def test_schedule_last_installment_absorbs_rounding(api):
    loan_id = create_loan(api, principal=20000, months=15)
    sched = api.get(f"/api/loans/{loan_id}").json()["schedule"]
    assert sched[0]["expected_amount"] == 2133.33
    assert sched[-1]["expected_amount"] == 2133.38


# ── Payments ──────────────────────────────────────────────────────────────────

def test_payment_month_out_of_range(api):
    loan_id = create_loan(api, months=10)
    assert pay(api, loan_id, 11, 1400).status_code == 400
    assert pay(api, loan_id, 0, 1400).status_code == 422


def test_payment_rejects_non_positive_amount(api):
    loan_id = create_loan(api)
    assert pay(api, loan_id, 1, 0).status_code == 422


def test_payment_rejects_future_date(api, freeze_today):
    freeze_today(date(2026, 3, 1))
    loan_id = create_loan(api)
    assert pay(api, loan_id, 1, 1400, on="2026-03-02").status_code == 400
    assert pay(api, loan_id, 1, 1400, on="2026-03-01").status_code == 200


def test_cannot_pay_completed_loan(api):
    loan_id = create_loan(api, months=1, principal=1000)
    assert pay(api, loan_id, 1, 1040).status_code == 200
    assert api.get(f"/api/loans/{loan_id}").json()["status"] == "completed"
    assert pay(api, loan_id, 1, 1040).status_code == 400


def test_partial_payment_then_top_up(api):
    loan_id = create_loan(api, months=2, principal=1000)  # 1080 total, 540/month
    assert pay(api, loan_id, 1, 540).status_code == 200
    assert pay(api, loan_id, 2, 200).status_code == 200

    loan = api.get(f"/api/loans/{loan_id}").json()
    assert [m["status"] for m in loan["schedule"]] == ["paid", "partial"]
    assert loan["schedule"][1]["outstanding"] == 340
    assert loan["status"] == "active"

    pid = loan["schedule"][1]["payment_id"]
    r = api.patch(f"/api/payments/{pid}", json={"amount": 540, "notes": "topped up"})
    assert r.status_code == 200, r.text
    loan = api.get(f"/api/loans/{loan_id}").json()
    assert loan["schedule"][1]["status"] == "paid"
    assert loan["schedule"][1]["notes"] == "topped up"
    assert loan["status"] == "completed"

    api.patch(f"/api/payments/{pid}", json={"amount": 100})
    assert api.get(f"/api/loans/{loan_id}").json()["status"] == "active"


def test_paid_within_50_paise_tolerance(api):
    loan_id = create_loan(api, months=1, principal=1000)  # 1040
    pay(api, loan_id, 1, 1039.6)
    assert api.get(f"/api/loans/{loan_id}").json()["status"] == "completed"


def test_list_counts_only_fully_paid_months(api):
    loan_id = create_loan(api, months=3, principal=1000)
    pay(api, loan_id, 1, 1120 / 3)
    pay(api, loan_id, 2, 10)
    assert api.get("/api/loans").json()[0]["months_paid"] == 1


def test_other_users_payment_cannot_be_patched(client, api):
    from helpers import make_user

    loan_id = create_loan(api)
    pid = pay(api, loan_id, 1, 1400).json()["id"]
    mallory = make_user(client, "mallory")
    assert mallory.patch(f"/api/payments/{pid}", json={"amount": 1}).status_code == 404


# ── Overdue & IST dates ───────────────────────────────────────────────────────

def test_schedule_marks_overdue(api, freeze_today):
    freeze_today(date(2026, 4, 20))
    loan_id = create_loan(api, loan_date="2026-01-15", months=10)  # due 15th from Feb
    pay(api, loan_id, 1, 1400)
    pay(api, loan_id, 2, 500)
    sched = api.get(f"/api/loans/{loan_id}").json()["schedule"]
    assert [m["overdue"] for m in sched[:5]] == [False, True, True, False, False]
    assert sched[3]["due_date"] == "2026-05-15"


def test_overdue_endpoint(api, freeze_today):
    freeze_today(date(2026, 4, 20))
    loan_id = create_loan(api, name="Ira", loan_date="2026-01-15", months=10)
    pay(api, loan_id, 1, 1400)
    pay(api, loan_id, 2, 500)
    r = api.get("/api/overdue").json()
    assert r["count"] == 2
    assert r["total_outstanding"] == 900 + 1400
    first = r["items"][0]
    assert first["borrower_name"] == "Ira"
    assert first["month_number"] == 2
    assert first["days_overdue"] == 36
    assert api.get("/api/loans").json()[0]["overdue_count"] == 2


def test_monthly_collection_uses_frozen_today(api, freeze_today):
    freeze_today(date(2026, 3, 5))
    loan_id = create_loan(api, loan_date="2026-01-15", months=10)
    pay(api, loan_id, 2, 700)
    m = api.get("/api/monthly-collection").json()
    assert m["month"] == "March 2026"
    assert m["expected_total"] == 1400
    assert m["collected_total"] == 700
    assert m["emis"][0]["status"] == "partial"


def test_today_is_india_time():
    late_utc = datetime(2026, 1, 31, 20, 0, tzinfo=timezone.utc)  # 01:30 IST on Feb 1
    assert timeutil.today(late_utc) == date(2026, 2, 1)
