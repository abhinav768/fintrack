"""Bring the database schema up to date. Run before the web server starts."""
import logging
import os

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

import database

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASELINE_REVISION = "0001_baseline"

logger = logging.getLogger("fintrack")


def alembic_config(url: str | None = None) -> Config:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    if url:
        cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def bootstrap(url: str | None = None) -> None:
    engine = create_engine(url) if url else database.engine
    tables = set(inspect(engine).get_table_names())
    cfg = alembic_config(url)
    if "users" in tables and "alembic_version" not in tables:
        logger.info("Existing pre-Alembic database detected; stamping %s", BASELINE_REVISION)
        command.stamp(cfg, BASELINE_REVISION)
    command.upgrade(cfg, "head")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    bootstrap()
