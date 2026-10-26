import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from frontend_static import register_frontend


@pytest.fixture
def static_client(tmp_path):
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>index</html>")
    (static / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("TOPSECRET")
    app = FastAPI()
    register_frontend(app, str(static))
    return TestClient(app)


@pytest.mark.parametrize(
    "path",
    ["/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt", "/%2e%2e%2fsecret.txt"],
)
def test_path_traversal_is_blocked(static_client, path):
    r = static_client.get(path)
    assert "TOPSECRET" not in r.text


def test_serves_real_static_file(static_client):
    assert static_client.get("/favicon.svg").text == "<svg/>"


def test_client_routes_fall_back_to_index(static_client):
    assert static_client.get("/loans/12").text == "<html>index</html>"


def test_unknown_api_route_is_json_404(static_client):
    r = static_client.get("/api/does-not-exist")
    assert r.status_code == 404
    assert r.json() == {"detail": "Not found"}
