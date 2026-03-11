"""
Non-blocking Splunk HEC logging handler.

Sends structured JSON log events to Splunk's HTTP Event Collector
in a background thread so application performance is unaffected.
If Splunk is unreachable, logs are silently dropped (console logging
still works via the default handler).
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from queue import Queue, Empty

import httpx

SPLUNK_HEC_URL = os.environ.get("SPLUNK_HEC_URL", "")
SPLUNK_HEC_TOKEN = os.environ.get("SPLUNK_HEC_TOKEN", "")

_BATCH_SIZE = 10
_FLUSH_INTERVAL = 5  # seconds


class SplunkHECHandler(logging.Handler):
    """Queues log records and sends them to Splunk HEC in batches."""

    def __init__(self, hec_url: str, hec_token: str):
        super().__init__()
        self.hec_url = hec_url
        self.headers = {"Authorization": f"Splunk {hec_token}"}
        self._queue: Queue = Queue(maxsize=5000)
        self._shutdown = threading.Event()
        self._worker = threading.Thread(target=self._run, daemon=True)
        self._worker.start()

    def emit(self, record: logging.LogRecord):
        try:
            event = self._format_event(record)
            self._queue.put_nowait(event)
        except Exception:
            pass

    def _format_event(self, record: logging.LogRecord) -> dict:
        event_data = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
        }
        if hasattr(record, "extra_fields"):
            event_data.update(record.extra_fields)
        if record.exc_info and record.exc_info[1]:
            event_data["exception"] = str(record.exc_info[1])

        return {
            "time": record.created,
            "host": "fintrack-render",
            "source": "fintrack-backend",
            "sourcetype": "_json",
            "index": "fintrack",
            "event": event_data,
        }

    def _run(self):
        """Background worker: batches events and sends to HEC."""
        while not self._shutdown.is_set():
            batch = []
            deadline = time.monotonic() + _FLUSH_INTERVAL
            while len(batch) < _BATCH_SIZE:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    batch.append(self._queue.get(timeout=min(remaining, 1.0)))
                except Empty:
                    continue
            if batch:
                self._send(batch)

    def _send(self, batch: list[dict]):
        payload = "\n".join(json.dumps(evt) for evt in batch)
        try:
            httpx.post(
                self.hec_url,
                content=payload,
                headers=self.headers,
                timeout=10,
            )
        except Exception:
            pass

    def close(self):
        self._shutdown.set()
        super().close()


def setup_splunk_logging():
    """Attach the Splunk HEC handler to the fintrack logger if configured."""
    if not SPLUNK_HEC_URL or not SPLUNK_HEC_TOKEN:
        logging.getLogger("fintrack").info(
            "Splunk HEC not configured (SPLUNK_HEC_URL / SPLUNK_HEC_TOKEN missing). "
            "Logs will only go to console."
        )
        return

    handler = SplunkHECHandler(SPLUNK_HEC_URL, SPLUNK_HEC_TOKEN)
    handler.setLevel(logging.INFO)

    logger = logging.getLogger("fintrack")
    logger.addHandler(handler)
    logger.info("Splunk HEC handler attached — logs will be sent to Splunk")
