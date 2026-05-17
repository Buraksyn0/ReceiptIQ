"""add_push_token_to_user

Revision ID: j8e9f0a1b2c3
Revises: i7d8e9f0a1b2
Create Date: 2026-05-13 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'j8e9f0a1b2c3'
down_revision: Union[str, None] = 'i7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('push_token', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'push_token')
