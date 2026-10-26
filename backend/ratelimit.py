import jwt
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth import JWT_ALGORITHM, JWT_SECRET


def user_or_ip(request: Request) -> str:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        try:
            payload = jwt.decode(header[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return f"user:{payload['sub']}"
        except (jwt.InvalidTokenError, KeyError):
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=get_remote_address)
