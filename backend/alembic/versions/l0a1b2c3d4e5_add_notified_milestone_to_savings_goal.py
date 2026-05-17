"""add notified_milestone to savings_goal

Revision ID: l0a1b2c3d4e5
Revises: k9f0a1b2c3d4
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'l0a1b2c3d4e5'
down_revision = 'k9f0a1b2c3d4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('savingsgoal',
        sa.Column('notified_milestone', sa.Integer(), nullable=False, server_default='0')
    )


def downgrade():
    op.drop_column('savingsgoal', 'notified_milestone')
