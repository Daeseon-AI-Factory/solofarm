"""add dilution_ratio to chemical_usage

Revision ID: a4c91e72f6bd
Revises: b2c8f3a91d47
Create Date: 2026-07-13 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a4c91e72f6bd"
down_revision: str | Sequence[str] | None = "b2c8f3a91d47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Store the optional dilution ratio recorded for a chemical application."""
    op.add_column(
        "chemical_usage",
        sa.Column("dilution_ratio", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    """Remove the optional chemical dilution ratio."""
    op.drop_column("chemical_usage", "dilution_ratio")
