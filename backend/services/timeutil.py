import os
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

APP_TZ = ZoneInfo(os.environ.get("APP_TIMEZONE", "Asia/Kolkata"))


def today(at: datetime | None = None) -> date:
    """Today's date in the app timezone. Call as `timeutil.today()` so tests can freeze it."""
    return (at or datetime.now(timezone.utc)).astimezone(APP_TZ).date()


def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
