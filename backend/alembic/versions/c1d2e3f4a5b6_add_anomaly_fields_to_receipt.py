"""add anomaly fields to receipt

Revision ID: c1d2e3f4a5b6
Revises: f3c2d1e8b4a9
Create Date: 2026-05-05 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'f3c2d1e8b4a9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'receipt',
        sa.Column('is_anomaly', sa.Boolean(), nullable=False, server_default='false')
    )
    op.add_column(
        'receipt',
        sa.Column('anomaly_score', sa.Float(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('receipt', 'anomaly_score')
    op.drop_column('receipt', 'is_anomaly')
