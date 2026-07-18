"""
JWT token handling — issue and verify tokens.

# CORE_CANDIDATE — reusable across any product needing JWT auth.
"""

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
# Download tokens ride in the URL query string (?token=), which is logged by
# servers/proxies and kept in browser history. Keep their lifetime tiny so a
# leaked link grants read-only PDF access for minutes, not a full session.
DOWNLOAD_TOKEN_EXPIRE_MINUTES = 10
# Marks a token as usable ONLY on the download query-param path. Session
# dependencies reject this scope; the download path requires it.
DOWNLOAD_SCOPE = "download"


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


def create_download_token(subject: str, role: str = "farmer") -> str:
    """
    Create a short-lived, download-scoped JWT for browser PDF/export links.

    Unlike the 24h session token, this carries `scope="download"` and expires
    in minutes. It is the only credential the download query-param path accepts,
    so a full session token can never sit in a URL — and this token grants
    nothing but the download itself, and only briefly.
    """
    expire = datetime.now(UTC) + timedelta(minutes=DOWNLOAD_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "role": role,
        "scope": DOWNLOAD_SCOPE,
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
