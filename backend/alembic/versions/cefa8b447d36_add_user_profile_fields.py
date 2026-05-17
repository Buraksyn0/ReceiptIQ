"""add city and theme_preference to user

Revision ID: cefa8b447d36
Revises: b944cb62a7d6
Create Date: 2026-04-25 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "cefa8b447d36"
down_revision: Union[str, None] = "b944cb62a7d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add nullable city
    op.add_column("user", sa.Column("city", sa.String(length=100), nullable=True))

    # Add theme_preference with default 'light' (NOT NULL via server_default)
    op.add_column(
        "user",
        sa.Column(
            "theme_preference",
            sa.String(length=10),
            nullable=False,
            server_default="light",
        ),
    )


def downgrade() -> None:
    op.drop_column("user", "theme_preference")
    op.drop_column("user", "city")
