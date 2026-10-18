"""add attempts to passwordresetcode

Revision ID: q5f6a7b8c9d0
Revises: p4e5f6a7b8c9
Create Date: 2026-10-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'q5f6a7b8c9d0'
down_revision = 'p4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'passwordresetcode',
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('passwordresetcode', 'attempts')
