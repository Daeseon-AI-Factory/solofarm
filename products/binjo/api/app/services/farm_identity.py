"""Resolve the farm identity used by the single-farm BINJO deployment."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.farmer import farm_identity_table


class SingleFarmResolutionError(RuntimeError):
    """Raised when a database does not contain exactly one farm."""

    def __init__(self, farm_count: int) -> None:
        self.farm_count = farm_count
        super().__init__(f"Expected exactly one farm, found {farm_count}")


async def resolve_single_farm_id(db: AsyncSession) -> uuid.UUID:
    """Return the only farm ID, refusing to guess when none or several exist."""
    result = await db.execute(
        select(farm_identity_table.c.id)
        .order_by(farm_identity_table.c.id)
        .limit(2)
    )
    farm_ids = list(result.scalars().all())
    if len(farm_ids) != 1:
        raise SingleFarmResolutionError(len(farm_ids))
    return farm_ids[0]
