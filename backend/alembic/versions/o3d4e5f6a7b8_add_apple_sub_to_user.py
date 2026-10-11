"""add apple_sub to user

Revision ID: o3d4e5f6a7b8
Revises: n2c3d4e5f6a7
Create Date: 2026-10-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'o3d4e5f6a7b8'
down_revision = 'n2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('apple_sub', sa.String(255), nullable=True))
    op.create_index(op.f('ix_user_apple_sub'), 'user', ['apple_sub'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_apple_sub'), table_name='user')
    op.drop_column('user', 'apple_sub')
