"""enforce farmer farm identity

Revision ID: d7e4a9b21c6f
Revises: a4c91e72f6bd
Create Date: 2026-07-13 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7e4a9b21c6f"
down_revision: str | Sequence[str] | None = "a4c91e72f6bd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_farm = sa.table("farm", sa.column("id", sa.UUID()))
_farmer = sa.table(
    "farmer",
    sa.column("id", sa.UUID()),
    sa.column("farm_id", sa.UUID()),
)


def upgrade() -> None:
    """Backfill only an unambiguous farm, then enforce the relationship."""
    bind = op.get_bind()

    # PostgreSQL is the only supported database. These locks keep the farm set
    # and farmer rows stable between the safety checks and constraint creation.
    bind.execute(sa.text('LOCK TABLE "farm" IN SHARE MODE'))
    bind.execute(sa.text('LOCK TABLE "farmer" IN SHARE ROW EXCLUSIVE MODE'))

    missing_farm_count = bind.execute(
        sa.select(sa.func.count()).select_from(_farmer).where(_farmer.c.farm_id.is_(None))
    ).scalar_one()

    if missing_farm_count:
        farm_ids = list(
            bind.execute(sa.select(_farm.c.id).order_by(_farm.c.id).limit(2)).scalars()
        )
        if len(farm_ids) != 1:
            raise RuntimeError(
                "Cannot backfill farmer.farm_id: "
                f"{missing_farm_count} farmer row(s) are unassigned and "
                f"the database has {'no farms' if not farm_ids else 'multiple farms'}"
            )
        bind.execute(
            sa.update(_farmer)
            .where(_farmer.c.farm_id.is_(None))
            .values(farm_id=farm_ids[0])
        )

    orphan_count = bind.execute(
        sa.select(sa.func.count())
        .select_from(_farmer.outerjoin(_farm, _farmer.c.farm_id == _farm.c.id))
        .where(_farmer.c.farm_id.is_not(None), _farm.c.id.is_(None))
    ).scalar_one()
    if orphan_count:
        raise RuntimeError(
            "Cannot enforce farmer.farm_id: "
            f"{orphan_count} farmer row(s) reference a farm that does not exist"
        )

    op.alter_column(
        "farmer",
        "farm_id",
        existing_type=sa.UUID(),
        nullable=False,
    )
    op.create_foreign_key(
        "fk_farmer_farm_id_farm",
        "farmer",
        "farm",
        ["farm_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    """Allow unassigned farmers again without discarding resolved identities."""
    op.drop_constraint("fk_farmer_farm_id_farm", "farmer", type_="foreignkey")
    op.alter_column(
        "farmer",
        "farm_id",
        existing_type=sa.UUID(),
        nullable=True,
    )
