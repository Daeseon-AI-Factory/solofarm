"""Configuration safety checks for hosted startup failures."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_invalid_test_login_config_does_not_echo_supplied_secrets() -> None:
    secret = "must-not-appear-in-validation-output"

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url="postgresql://test:test@localhost/test",
            direct_url="postgresql://test:test@localhost/test",
            jwt_secret=secret,
            enable_dev_login=True,
            dev_login_access_code="",
            _env_file=None,
        )

    assert secret not in str(exc_info.value)


def _settings_with_jwt_secret(secret: str) -> Settings:
    return Settings(
        database_url="postgresql://test:test@localhost/test",
        direct_url="postgresql://test:test@localhost/test",
        jwt_secret=secret,
        _env_file=None,
    )


@pytest.mark.parametrize("secret", ["", "short", "a" * 31])
def test_empty_or_short_jwt_secret_is_rejected(secret: str) -> None:
    # An empty or short HMAC key is the whole vulnerability: HS256 signs with the
    # raw string, so a weak key lets anyone forge a valid admin token. The app
    # must refuse to start rather than boot with a forgeable signing key.
    with pytest.raises(ValidationError):
        _settings_with_jwt_secret(secret)


def test_strong_jwt_secret_boots() -> None:
    settings = _settings_with_jwt_secret("a" * 32)
    assert settings.jwt_secret == "a" * 32


def test_jwt_secret_rejection_does_not_echo_supplied_secrets() -> None:
    # The JWT guard lives on CoreSettings, which also holds api keys. Its
    # ValidationError must not embed any supplied secret into logs.
    sentinel = "must-not-appear-jwt"
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url="postgresql://test:test@localhost/test",
            direct_url="postgresql://test:test@localhost/test",
            jwt_secret=sentinel,
            anthropic_api_key="sk-sentinel-must-not-appear",
            _env_file=None,
        )

    rendered = str(exc_info.value)
    assert sentinel not in rendered
    assert "sk-sentinel-must-not-appear" not in rendered
