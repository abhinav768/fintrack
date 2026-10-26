import csv
import io
from datetime import date

import pytest
from sqlalchemy import event

from helpers import create_loan, make_user
from services import notify, timeutil


@pytest.fixture
def sent(monkeypatch):
    calls = []
    monkeypatch.setattr(notify, "send_ntfy", lambda topic, title, msg: calls.append((topic, title, msg)))
    return calls


def setup_reminders(api, monkeypatch, secret="s" * 32):
    api.put("/api/settings/notifications", json={"ntfy_topic": "my-topic", "ntfy_topic_2": "", "notify_secret": secret})
    monkeypatch.setattr(timeutil, "today", lambda at=None: date(2026, 2, 15))
    create_loan(api, name="Secret Name", loan_date="2026-01-15")


# ── Reminders ─────────────────────────────────────────────────────────────────

def test_reminder_with_header_token_hides_borrower_names(client, api, monkeypatch, sent):
    setup_reminders(api, monkeypatch)
    r = client.get("/api/notify/daily-reminders", headers={"X-Notify-Token": "s" * 32})
    assert r.json()["sent"] is True
    topic, title, msg = sent[0]
    assert topic == "my-topic"
    assert "Secret Name" not in msg
    assert "1,400" in msg


def test_reminder_query_token_still_works(client, api, monkeypatch, sent):
    setup_reminders(api, monkeypatch)
    assert client.get("/api/notify/daily-reminders", params={"token": "s" * 32}).json()["sent"] is True


def test_reminder_wrong_or_missing_token(client, api, monkeypatch, sent):
    setup_reminders(api, monkeypatch)
    assert client.get("/api/notify/daily-reminders", headers={"X-Notify-Token": "wrong"}).json()["sent"] is False
    assert client.get("/api/notify/daily-reminders").status_code == 401
    assert sent == []


def test_generate_secret(api):
    a = api.post("/api/settings/notifications/generate-secret").json()["notify_secret"]
    b = api.post("/api/settings/notifications/generate-secret").json()["notify_secret"]
    assert len(a) >= 32 and a != b


def test_notification_topic_validation(api):
    r = api.put("/api/settings/notifications", json={"ntfy_topic": "bad topic/../x", "notify_secret": "s" * 32})
    assert r.status_code == 422
    r = api.put("/api/settings/notifications", json={"ntfy_topic": "ok-topic", "notify_secret": "short"})
    assert r.status_code == 422


# ── Borrowers ─────────────────────────────────────────────────────────────────

def test_edit_borrower(api):
    bid = api.post("/api/borrowers", json={"name": "Old", "phone": "1"}).json()["id"]
    r = api.put(f"/api/borrowers/{bid}", json={"name": "New", "phone": "999"})
    assert r.status_code == 200
    assert api.get("/api/borrowers").json()[0] == {
        "id": bid, "name": "New", "phone": "999", "active_loans": 0, "total_loans": 0,
    }


def test_borrower_detail(api):
    loan_id = create_loan(api, name="Kim", principal=10000)
    api.post(f"/api/loans/{loan_id}/payments", json={"amount": 1400, "month_number": 1, "payment_date": "2026-02-15"})
    bid = api.get("/api/borrowers").json()[0]["id"]
    d = api.get(f"/api/borrowers/{bid}").json()
    assert d["name"] == "Kim"
    assert d["totals"]["lent"] == 10000
    assert d["totals"]["collected"] == 1400
    assert d["totals"]["outstanding"] == 12600
    assert d["loans"][0]["id"] == loan_id


def test_borrower_isolation(client, api):
    bid = api.post("/api/borrowers", json={"name": "Mine"}).json()["id"]
    other = make_user(client, "other")
    assert other.get(f"/api/borrowers/{bid}").status_code == 404
    assert other.put(f"/api/borrowers/{bid}", json={"name": "x"}).status_code == 404


# ── Loan edit ─────────────────────────────────────────────────────────────────

def test_edit_loan_terms_before_payments(api):
    loan_id = create_loan(api, principal=10000, months=10)
    r = api.put(f"/api/loans/{loan_id}", json={"principal": 20000, "total_months": 15})
    assert r.status_code == 200, r.text
    loan = api.get(f"/api/loans/{loan_id}").json()
    assert loan["total_return"] == 32000
    assert len(loan["schedule"]) == 15


def test_edit_loan_terms_blocked_after_payment(api):
    loan_id = create_loan(api)
    api.post(f"/api/loans/{loan_id}/payments", json={"amount": 1400, "month_number": 1, "payment_date": "2026-02-15"})
    assert api.put(f"/api/loans/{loan_id}", json={"principal": 5}).status_code == 400
    other_bid = api.post("/api/borrowers", json={"name": "Other"}).json()["id"]
    assert api.put(f"/api/loans/{loan_id}", json={"borrower_id": other_bid}).status_code == 200
    assert api.get(f"/api/loans/{loan_id}").json()["borrower_name"] == "Other"


# ── Export ────────────────────────────────────────────────────────────────────

def test_export_loans_csv(api):
    create_loan(api, name="=HYPERLINK(evil)", principal=10000)
    r = api.get("/api/export/loans.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    rows = list(csv.DictReader(io.StringIO(r.text)))
    assert rows[0]["borrower"] == "'=HYPERLINK(evil)"
    assert rows[0]["principal"] == "10000.00"


def test_export_payments_csv(api):
    loan_id = create_loan(api, name="Lee")
    api.post(f"/api/loans/{loan_id}/payments", json={"amount": 1400, "month_number": 1, "payment_date": "2026-02-15"})
    rows = list(csv.DictReader(io.StringIO(api.get("/api/export/payments.csv").text)))
    assert rows == [{
        "payment_id": rows[0]["payment_id"], "loan_id": str(loan_id), "borrower": "Lee",
        "month_number": "1", "amount": "1400.00", "payment_date": "2026-02-15", "notes": "",
    }]


# ── Health & performance ──────────────────────────────────────────────────────

def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "db": "ok"}


def test_list_loans_query_count_is_constant(api, engine):
    for i in range(5):
        create_loan(api, name=f"B{i}")
    count = {"n": 0}

    def before(*args, **kwargs):
        count["n"] += 1

    event.listen(engine, "before_cursor_execute", before)
    try:
        assert len(api.get("/api/loans").json()) == 5
        loans_queries = count["n"]
        count["n"] = 0
        assert len(api.get("/api/borrowers").json()) == 5
        borrowers_queries = count["n"]
    finally:
        event.remove(engine, "before_cursor_execute", before)
    assert loans_queries <= 5
    assert borrowers_queries <= 5
