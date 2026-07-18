"""Safety tests for the farmer-to-farm integrity migration."""

import importlib.util
from pathlib import Path
from types import ModuleType
from uuid import uuid4

import pytest


class _Result:
    def __init__(self, *, scalar: int | None = None, values: list[object] | None = None) -> None:
        self._scalar = scalar
        self._values = values or []

    def scalar_one(self) -> int:
        assert self._scalar is not None
        return self._scalar

    def scalars(self) -> list[object]:
        return self._values


class _Bind:
    def __init__(self, results: list[_Result]) -> None:
        self.results = results
        self.statements: list[object] = []

    def execute(self, statement: object) -> _Result:
        self.statements.append(statement)
        return self.results.pop(0)


class _Op:
    def __init__(self, bind: _Bind) -> None:
        self.bind = bind
        self.altered_columns: list[tuple[tuple[object, ...], dict[str, object]]] = []
        self.created_foreign_keys: list[tuple[tuple[object, ...], dict[str, object]]] = []
        self.dropped_constraints: list[tuple[tuple[object, ...], dict[str, object]]] = []

    def get_bind(self) -> _Bind:
        return self.bind

    def alter_column(self, *args: object, **kwargs: object) -> None:
        self.altered_columns.append((args, kwargs))

    def create_foreign_key(self, *args: object, **kwargs: object) -> None:
        self.created_foreign_keys.append((args, kwargs))

    def drop_constraint(self, *args: object, **kwargs: object) -> None:
        self.dropped_constraints.append((args, kwargs))


@pytest.fixture
def migration() -> ModuleType:
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "d7e4a9b21c6f_enforce_farmer_farm_identity.py"
    )
    spec = importlib.util.spec_from_file_location("farmer_farm_identity_migration", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _migration_op(
    migration: ModuleType,
    *,
    missing_farm_count: int,
    farm_ids: list[object] | None = None,
    orphan_count: int = 0,
) -> _Op:
    results = [_Result(), _Result(), _Result(scalar=missing_farm_count)]
    if missing_farm_count:
        results.extend([_Result(values=farm_ids), _Result()])
    results.append(_Result(scalar=orphan_count))
    operation = _Op(_Bind(results))
    migration.op = operation
    return operation


def test_migration_backfills_only_farm_and_enforces_integrity(
    migration: ModuleType,
) -> None:
    farm_id = uuid4()
    operation = _migration_op(
        migration,
        missing_farm_count=2,
        farm_ids=[farm_id],
    )

    migration.upgrade()

    assert any(
        str(statement).startswith("UPDATE farmer") for statement in operation.bind.statements
    )
    assert operation.altered_columns[0][1]["nullable"] is False
    assert operation.created_foreign_keys[0][0][0] == "fk_farmer_farm_id_farm"
    assert operation.created_foreign_keys[0][1]["ondelete"] == "RESTRICT"


@pytest.mark.parametrize("farm_ids", [[], [uuid4(), uuid4()]])
def test_migration_refuses_to_guess_when_backfill_is_ambiguous(
    migration: ModuleType,
    farm_ids: list[object],
) -> None:
    operation = _migration_op(
        migration,
        missing_farm_count=1,
        farm_ids=farm_ids,
    )

    with pytest.raises(RuntimeError, match="Cannot backfill farmer.farm_id"):
        migration.upgrade()

    assert operation.altered_columns == []
    assert operation.created_foreign_keys == []


def test_migration_refuses_existing_orphaned_farm_ids(migration: ModuleType) -> None:
    operation = _migration_op(
        migration,
        missing_farm_count=0,
        orphan_count=1,
    )

    with pytest.raises(RuntimeError, match="reference a farm that does not exist"):
        migration.upgrade()

    assert operation.altered_columns == []
    assert operation.created_foreign_keys == []


def test_migration_downgrade_removes_constraint_before_nullability(
    migration: ModuleType,
) -> None:
    operation = _Op(_Bind([]))
    migration.op = operation

    migration.downgrade()

    assert operation.dropped_constraints[0][0] == (
        "fk_farmer_farm_id_farm",
        "farmer",
    )
    assert operation.altered_columns[0][1]["nullable"] is True
