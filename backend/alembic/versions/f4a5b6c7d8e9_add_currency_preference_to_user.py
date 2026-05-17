"""add currency_preference to user

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-05-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f4a5b6c7d8e9'
down_revision = 'e3f4a5b6c7d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'user',
        sa.Column(
            'currency_preference',
            sa.String(3),
            server_default='TRY',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('user', 'currency_preference')
