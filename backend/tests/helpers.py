class Api:
    """Test client wrapper that adds the auth header and profile_id like the frontend does."""

    def __init__(self, client, token, profile_id):
        self.client = client
        self.token = token
        self.profile_id = profile_id

    def _kwargs(self, kwargs, with_profile=True):
        headers = {"Authorization": f"Bearer {self.token}", **kwargs.pop("headers", {})}
        params = dict(kwargs.pop("params", {}))
        if with_profile:
            params.setdefault("profile_id", self.profile_id)
        return {"headers": headers, "params": params, **kwargs}

    def get(self, path, **kw):
        return self.client.get(path, **self._kwargs(kw))

    def post(self, path, **kw):
        return self.client.post(path, **self._kwargs(kw))

    def put(self, path, **kw):
        return self.client.put(path, **self._kwargs(kw))

    def patch(self, path, **kw):
        return self.client.patch(path, **self._kwargs(kw))

    def delete(self, path, **kw):
        return self.client.delete(path, **self._kwargs(kw))


def make_user(client, username="alice", password="password123"):
    r = client.post("/api/auth/signup", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    profiles = client.get(
        "/api/profiles", headers={"Authorization": f"Bearer {token}"}
    ).json()
    return Api(client, token, profiles[0]["id"])


def create_loan(api, name="Bob", principal=10000, months=10, loan_date="2026-01-15", **extra):
    b = api.post("/api/borrowers", json={"name": name})
    assert b.status_code == 200, b.text
    payload = {
        "borrower_id": b.json()["id"],
        "principal": principal,
        "total_months": months,
        "loan_date": loan_date,
        **extra,
    }
    r = api.post("/api/loans", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["id"]
