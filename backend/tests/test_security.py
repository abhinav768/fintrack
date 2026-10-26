import logging

import pytest

import auth
from helpers import create_loan, make_user
from ratelimit import limiter
from routers import chat as chat_router


@pytest.mark.parametrize("username", ["ab", "has space", "x" * 33, "bad!char"])
def test_signup_rejects_bad_usernames(client, username):
    r = client.post("/api/auth/signup", json={"username": username, "password": "password123"})
    assert r.status_code == 422


def test_signup_requires_8_char_password(client):
    r = client.post("/api/auth/signup", json={"username": "erin", "password": "short"})
    assert r.status_code == 422


def test_signup_username_is_case_insensitive_unique(client):
    make_user(client, "Frank")
    r = client.post("/api/auth/signup", json={"username": "frank", "password": "password123"})
    assert r.status_code == 400


def test_existing_short_password_can_still_log_in(client, db):
    import models

    db.add(models.User(username="legacy", password_hash=auth.hash_password("abc")))
    db.commit()
    assert client.post("/api/auth/login", json={"username": "legacy", "password": "abc"}).status_code == 200


def test_change_password(client):
    api = make_user(client, "gina", "password123")
    bad = api.post("/api/auth/change-password", json={"current_password": "wrong", "new_password": "newpassword1"})
    assert bad.status_code == 400
    ok = api.post("/api/auth/change-password", json={"current_password": "password123", "new_password": "newpassword1"})
    assert ok.status_code == 200
    assert client.post("/api/auth/login", json={"username": "gina", "password": "newpassword1"}).status_code == 200
    assert client.post("/api/auth/login", json={"username": "gina", "password": "password123"}).status_code == 401


@pytest.mark.parametrize(
    "payload",
    [
        {"principal": 0},
        {"principal": -5},
        {"total_months": 0},
        {"total_months": 121},
    ],
)
def test_loan_input_limits(api, payload):
    b = api.post("/api/borrowers", json={"name": "Hank"}).json()
    body = {"borrower_id": b["id"], "principal": 1000, "total_months": 10, "loan_date": "2026-01-01", **payload}
    assert api.post("/api/loans", json=body).status_code == 422


def test_borrower_name_length_limit(api):
    assert api.post("/api/borrowers", json={"name": "x" * 101}).status_code == 422
    assert api.post("/api/borrowers", json={"name": "   "}).status_code == 422


def test_login_rate_limited(client):
    limiter.enabled = True
    limiter.reset()
    try:
        codes = [
            client.post("/api/auth/login", json={"username": "nobody", "password": "x"}).status_code
            for _ in range(11)
        ]
    finally:
        limiter.enabled = False
    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_chat_error_does_not_leak_details(api, monkeypatch):
    monkeypatch.setattr(chat_router, "GEMINI_API_KEY", "fake")

    def boom(prompt):
        raise RuntimeError("secret internal detail https://key=abc")

    monkeypatch.setattr(chat_router, "generate_reply", boom)
    r = api.post("/api/chat", json={"message": "hi"})
    assert r.status_code == 502
    assert "secret" not in r.text


def test_chat_message_length_limit(api, monkeypatch):
    monkeypatch.setattr(chat_router, "GEMINI_API_KEY", "fake")
    assert api.post("/api/chat", json={"message": "x" * 1001}).status_code == 422


def test_jwt_secret_warning_in_production(monkeypatch, caplog):
    monkeypatch.setattr(auth, "JWT_SECRET", auth.DEV_JWT_SECRET)
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    with caplog.at_level(logging.ERROR, logger="fintrack"):
        auth.check_jwt_secret()
    assert "JWT_SECRET" in caplog.text
