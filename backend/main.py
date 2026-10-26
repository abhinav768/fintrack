import logging
import os
import time

from fastapi import FastAPI, Request

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fintrack")
logger.setLevel(logging.INFO)

from database import Base, engine
from frontend_static import register_frontend
from routers import auth, borrowers, chat, dashboard, loans, notifications, payments, profiles
from splunk_handler import setup_splunk_logging
import models  # noqa: F401  (registers tables on Base.metadata)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finance Tracker")

setup_splunk_logging()


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


for module in (auth, profiles, dashboard, borrowers, loans, payments, notifications, chat):
    app.include_router(module.router)

register_frontend(app, os.path.join(os.path.dirname(__file__), "static"))
