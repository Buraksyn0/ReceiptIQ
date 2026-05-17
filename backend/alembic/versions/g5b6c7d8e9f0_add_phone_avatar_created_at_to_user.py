"""add phone avatar created_at to user

Revision ID: g5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-05-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'g5b6c7d8e9f0'
down_revision = 'f4a5b6c7d8e9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('phone', sa.String(30), nullable=True))
    op.add_column('user', sa.Column('avatar_url', sa.String(500), nullable=True))
    op.add_column('user', sa.Column(
        'created_at',
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    ))


def downgrade() -> None:
    op.drop_column('user', 'created_at')
    op.drop_column('user', 'avatar_url')
    op.drop_column('user', 'phone')
