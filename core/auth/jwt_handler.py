"""
JWT token handling — issue and verify tokens.

# CORE_CANDIDATE — reusable across any product needing JWT auth.
"""

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def create_access_token(subject: str, role: str = "farmer") -> str:
    """
    Create a JWT with the user's ID as subject and role as a claim.
    Expires in 24 hours by default.
    """
    expire = datetime.now(UTC) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": subject,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    """
    Verify and decode a JWT. Returns the payload dict if valid, None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
