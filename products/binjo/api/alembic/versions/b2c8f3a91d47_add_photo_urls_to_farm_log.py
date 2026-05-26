"""add photo_urls JSONB column to farm_log

Revision ID: b2c8f3a91d47
Revises: 65a1c610afa0
Create Date: 2026-04-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c8f3a91d47'
down_revision: Union[str, Sequence[str], None] = '65a1c610afa0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add photo_urls JSONB column — stores array of Supabase Storage public URLs."""
    op.add_column(
        'farm_log',
        sa.Column('photo_urls', postgresql.JSONB(), server_default='[]', nullable=False),
    )


def downgrade() -> None:
    """Remove photo_urls column."""
    op.drop_column('farm_log', 'photo_urls')
