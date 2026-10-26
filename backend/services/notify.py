import logging

import httpx
from fastapi import HTTPException

logger = logging.getLogger("fintrack")


def send_ntfy(topic: str, title: str, message: str) -> None:
    try:
        resp = httpx.post(
            f"https://ntfy.sh/{topic}",
            content=message.encode("utf-8"),
            headers={"Title": title, "Priority": "high", "Tags": "moneybag"},
            timeout=30,
        )
    except httpx.HTTPError as e:
        logger.error("ntfy send failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not reach ntfy. Please try again.")
    if resp.status_code >= 400:
        logger.error("ntfy error %s: %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="ntfy rejected the notification. Check the topic name.")
    logger.info("ntfy sent: %s", resp.status_code)
