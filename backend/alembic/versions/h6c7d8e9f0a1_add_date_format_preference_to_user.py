"""add date_format_preference to user

Revision ID: h6c7d8e9f0a1
Revises: g5b6c7d8e9f0
Create Date: 2026-05-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'h6c7d8e9f0a1'
down_revision = 'g5b6c7d8e9f0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column(
        'date_format_preference',
        sa.String(20),
        server_default='DD/MM/YYYY',
        nullable=False,
    ))


def downgrade() -> None:
    op.drop_column('user', 'date_format_preference')
