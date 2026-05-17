"""add language_preference to user

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e3f4a5b6c7d8'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'user',
        sa.Column(
            'language_preference',
            sa.String(5),
            server_default='tr',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('user', 'language_preference')
