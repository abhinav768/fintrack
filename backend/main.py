import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fintrack")
logger.setLevel(logging.INFO)

from auth import check_jwt_secret
from frontend_static import register_frontend
from ratelimit import limiter
from routers import (
    auth, borrowers, chat, dashboard, export, health, loans, notifications, payments, profiles, transfers,
)
from splunk_handler import setup_splunk_logging

app = FastAPI(title="Finance Tracker")
app.state.limiter = limiter

setup_splunk_logging()
check_jwt_secret()


@app.exception_handler(RateLimitExceeded)
def rate_limited(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many attempts. Please wait a few minutes and try again."},
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every API request with method, path, status, and duration."""
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)

    if request.url.path.startswith("/api/"):
        logger.info(
            "API %s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={"extra_fields": {
                "event_type": "api_request",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            }},
        )
    return response


for module in (
    health, auth, profiles, dashboard, borrowers, loans, payments, transfers, notifications, chat, export,
):
    app.include_router(module.router)

register_frontend(app, os.path.join(os.path.dirname(__file__), "static"))
