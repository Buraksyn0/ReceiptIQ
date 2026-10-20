"""add apple_refresh_token to user

Revision ID: r6a7b8c9d0e1
Revises: q5f6a7b8c9d0
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'r6a7b8c9d0e1'
down_revision = 'q5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('apple_refresh_token', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'apple_refresh_token')
