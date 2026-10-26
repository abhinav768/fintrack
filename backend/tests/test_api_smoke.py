from helpers import create_loan, make_user


def test_auth_flow(client):
    r = client.post("/api/auth/signup", json={"username": "carol", "password": "password123"})
    assert r.status_code == 200
    assert client.post("/api/auth/signup", json={"username": "carol", "password": "password123"}).status_code == 400
    r = client.post("/api/auth/login", json={"username": "carol", "password": "password123"})
    assert r.status_code == 200
    token = r.json()["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["username"] == "carol"
    assert client.post("/api/auth/login", json={"username": "carol", "password": "nope"}).status_code == 401


def test_profiles_crud(api):
    created = api.post("/api/profiles", json={"name": "Second"}).json()
    assert {p["name"] for p in api.get("/api/profiles").json()} == {"alice's Portfolio", "Second"}
    assert api.put(f"/api/profiles/{created['id']}", json={"name": "Renamed"}).json()["name"] == "Renamed"
    assert api.delete(f"/api/profiles/{created['id']}").status_code == 200
    assert api.delete(f"/api/profiles/{api.profile_id}").status_code == 400


def test_loan_lifecycle(api):
    loan_id = create_loan(api, principal=10000, months=10, loan_date="2026-01-15")
    loan = api.get(f"/api/loans/{loan_id}").json()
    assert loan["total_return"] == 14000
    assert loan["monthly_emi"] == 1400
    assert loan["cycle_start_date"] == "2026-02-15"
    assert loan["schedule"][0]["due_date"] == "2026-02-15"
    assert len(loan["schedule"]) == 10

    for m in range(1, 11):
        r = api.post(
            f"/api/loans/{loan_id}/payments",
            json={"amount": 1400, "month_number": m, "payment_date": "2026-02-15"},
        )
        assert r.status_code == 200, r.text
    loan = api.get(f"/api/loans/{loan_id}").json()
    assert loan["status"] == "completed"
    assert loan["remaining"] == 0

    pid = loan["schedule"][9]["payment_id"]
    assert api.delete(f"/api/payments/{pid}").status_code == 200
    assert api.get(f"/api/loans/{loan_id}").json()["status"] == "active"

    listed = api.get("/api/loans").json()
    assert listed[0]["months_paid"] == 9

    assert api.delete(f"/api/loans/{loan_id}").status_code == 200
    assert api.get("/api/loans").json() == []


def test_duplicate_payment_rejected(api):
    loan_id = create_loan(api)
    body = {"amount": 1400, "month_number": 1, "payment_date": "2026-02-15"}
    assert api.post(f"/api/loans/{loan_id}/payments", json=body).status_code == 200
    assert api.post(f"/api/loans/{loan_id}/payments", json=body).status_code == 400


def test_dashboard_totals(api):
    loan_id = create_loan(api, principal=10000, months=10)
    api.post(f"/api/loans/{loan_id}/payments", json={"amount": 1400, "month_number": 1, "payment_date": "2026-02-15"})
    d = api.get("/api/dashboard").json()
    assert d["total_principal_given"] == 10000
    assert d["total_expected_return"] == 14000
    assert d["total_collected"] == 1400
    assert d["total_pending"] == 12600
    assert d["active_loans"] == 1


def test_borrower_delete_blocked_with_active_loan(api):
    create_loan(api, name="Dave")
    b = api.get("/api/borrowers").json()[0]
    assert b["active_loans"] == 1
    assert api.delete(f"/api/borrowers/{b['id']}").status_code == 400


def test_monthly_collection_shape(api):
    r = api.get("/api/monthly-collection").json()
    assert set(r) == {
        "month", "expected_total", "collected_total", "collected_online", "collected_cash",
        "pending_total", "emis",
    }


def test_profile_isolation(client):
    alice = make_user(client, "alice")
    bob = make_user(client, "bob")
    loan_id = create_loan(alice)
    borrower_id = alice.get("/api/borrowers").json()[0]["id"]

    assert bob.get(f"/api/loans/{loan_id}").status_code == 404
    assert bob.get("/api/loans", params={"profile_id": alice.profile_id}).status_code == 404
    assert bob.delete(f"/api/loans/{loan_id}").status_code == 404
    assert bob.delete(f"/api/borrowers/{borrower_id}").status_code == 404
    assert bob.post(
        f"/api/loans/{loan_id}/payments",
        json={"amount": 1, "month_number": 1, "payment_date": "2026-02-15"},
    ).status_code == 404
    assert bob.put(f"/api/profiles/{alice.profile_id}", json={"name": "x"}).status_code == 404
