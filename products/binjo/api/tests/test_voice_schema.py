"""Boundary tests for AI-produced farm-log data."""

import pytest
from pydantic import ValidationError

from app.schemas.voice import ParsedFarmLogData


def test_parsed_farm_log_defaults_optional_collections() -> None:
    parsed = ParsedFarmLogData.model_validate(
        {
            "date": "2026-07-11",
            "tasks": [{"stage": "적과"}],
        }
    )

    assert parsed.field_names == []
    assert parsed.chemicals == []


def test_parsed_farm_log_rejects_missing_tasks() -> None:
    with pytest.raises(ValidationError):
        ParsedFarmLogData.model_validate({"date": "2026-07-11"})
