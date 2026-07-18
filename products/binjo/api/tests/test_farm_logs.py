"""Unit tests for farm-log endpoint behavior."""

import os
from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

# app.config builds Settings during endpoint import, so clean-install tests need
# inert URLs even though these unit tests never open a database connection.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DIRECT_URL", "postgresql://test:test@localhost/test")

from app.api.v1.endpoints import farm_logs as farm_logs_endpoint
from app.api.v1.endpoints.farm_logs import (
    _log_to_response,
    confirm_farm_log,
    create_farm_log,
    delete_farm_log,
    update_farm_log,
)
from app.models.farm_log import ChemicalUsage, FarmLog, FarmLogTask
from app.schemas.farm_log import ChemicalCreate, FarmLogCreate, FarmLogUpdate, TaskCreate


def _chemical(dilution_ratio: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        type="농약",
        name="테스트 약제",
        amount="200리터",
        dilution_ratio=dilution_ratio,
        action="살포",
    )


def _farm_log(log_status: str) -> SimpleNamespace:
    now = datetime(2026, 7, 11, tzinfo=UTC)
    return SimpleNamespace(
        id=uuid4(),
        log_date=date(2026, 7, 11),
        status=log_status,
        crop="사과",
        tasks=[],
        chemicals=[],
        weather_official=None,
        weather_farmer=None,
        notes=None,
        photo_urls=[],
        voice_recording_id=None,
        created_at=now,
        updated_at=now,
    )


def _db_returning(log: SimpleNamespace) -> SimpleNamespace:
    result = MagicMock()
    result.scalar_one_or_none.return_value = log
    result.scalar_one.return_value = log
    return SimpleNamespace(
        execute=AsyncMock(return_value=result),
        add=MagicMock(),
        flush=AsyncMock(),
        commit=AsyncMock(),
        delete=AsyncMock(),
    )


@pytest.mark.asyncio
async def test_create_farm_log_returns_draft_with_dilution_ratio(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Create stores and returns dilution data without implicitly confirming the log."""
    created_log: FarmLog | None = None

    def add(instance: object) -> None:
        nonlocal created_log
        if isinstance(instance, FarmLog):
            instance.id = uuid4()
            instance.photo_urls = []
            instance.created_at = datetime(2026, 7, 13, tzinfo=UTC)
            instance.updated_at = instance.created_at
            created_log = instance
        elif isinstance(instance, FarmLogTask):
            instance.id = uuid4()
            assert created_log is not None
            created_log.tasks.append(instance)
        elif isinstance(instance, ChemicalUsage):
            instance.id = uuid4()
            assert created_log is not None
            created_log.chemicals.append(instance)

    def scalar_result() -> MagicMock:
        result = MagicMock()
        result.scalar_one.return_value = created_log
        return result

    db = SimpleNamespace(
        add=MagicMock(side_effect=add),
        flush=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(side_effect=lambda _query: scalar_result()),
    )
    farmer = SimpleNamespace(id=uuid4(), farm_id=None)
    monkeypatch.setattr(
        farm_logs_endpoint,
        "get_weather_for_date",
        AsyncMock(return_value=None),
    )
    body = FarmLogCreate(
        log_date=date(2026, 7, 13),
        tasks=[TaskCreate(stage="방제")],
        chemicals=[
            ChemicalCreate(
                type="농약",
                name="테스트 약제",
                amount="200리터",
                dilution_ratio="1000배",
                action="살포",
            )
        ],
    )

    response = await create_farm_log(body, farmer, db)

    assert response.status == "draft"
    assert response.chemicals[0].dilution_ratio == "1000배"
    db.commit.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_update_farm_log_preserves_status_and_replaces_dilution_ratio() -> None:
    """Update changes chemical details while leaving explicit confirmation state alone."""
    existing_log = _farm_log("draft")
    existing_chemical = _chemical()
    existing_log.chemicals = [existing_chemical]

    updated_log = _farm_log("draft")
    updated_log.chemicals = [_chemical("500배")]

    initial_result = MagicMock()
    initial_result.scalar_one_or_none.return_value = existing_log
    updated_result = MagicMock()
    updated_result.scalar_one.return_value = updated_log
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[initial_result, updated_result]),
        add=MagicMock(),
        commit=AsyncMock(),
        delete=AsyncMock(),
    )
    farmer = SimpleNamespace(id=uuid4())
    body = FarmLogUpdate(
        chemicals=[
            ChemicalCreate(
                type="농약",
                name="교체 약제",
                amount="100리터",
                dilution_ratio="500배",
                action="살포",
            )
        ]
    )

    response = await update_farm_log(str(existing_log.id), body, farmer, db)

    added_chemical = db.add.call_args.args[0]
    assert isinstance(added_chemical, ChemicalUsage)
    assert added_chemical.dilution_ratio == "500배"
    assert existing_log.status == "draft"
    assert response.status == "draft"
    assert response.chemicals[0].dilution_ratio == "500배"
    db.delete.assert_awaited_once_with(existing_chemical)
    db.commit.assert_awaited_once_with()


def test_legacy_chemical_response_defaults_dilution_ratio_to_null() -> None:
    """Rows created before the migration remain readable with a null ratio."""
    log = _farm_log("confirmed")
    log.chemicals = [_chemical()]

    response = _log_to_response(log)

    assert ChemicalCreate(type="농약", name="기존 약제").dilution_ratio is None
    assert response.chemicals[0].dilution_ratio is None


@pytest.mark.asyncio
async def test_confirm_farm_log_confirms_draft() -> None:
    log = _farm_log("draft")
    farmer = SimpleNamespace(id=uuid4())
    db = _db_returning(log)

    response = await confirm_farm_log(str(log.id), farmer, db)

    assert response.id == str(log.id)
    assert response.status == "confirmed"
    db.commit.assert_awaited_once_with()
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_confirm_farm_log_is_idempotent_when_already_confirmed() -> None:
    log = _farm_log("confirmed")
    farmer = SimpleNamespace(id=uuid4())
    db = _db_returning(log)

    response = await confirm_farm_log(str(log.id), farmer, db)

    assert response.id == str(log.id)
    assert response.status == "confirmed"
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_voice_log_returns_existing_row_on_retry() -> None:
    log = _farm_log("draft")
    log.voice_recording_id = uuid4()
    farmer = SimpleNamespace(id=uuid4())
    db = _db_returning(log)
    body = FarmLogCreate(
        voice_recording_id=log.voice_recording_id,
        log_date=log.log_date,
        tasks=[],
    )

    response = await create_farm_log(body, farmer, db)

    assert response.id == str(log.id)
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_draft_only_delete_preserves_confirmed_log() -> None:
    log = _farm_log("confirmed")
    farmer = SimpleNamespace(id=uuid4())
    db = _db_returning(log)

    with pytest.raises(HTTPException) as exc_info:
        await delete_farm_log(
            str(log.id),
            draft_only=True,
            farmer=farmer,
            db=db,
        )

    assert exc_info.value.status_code == 409
    db.delete.assert_not_awaited()
    db.commit.assert_not_awaited()
