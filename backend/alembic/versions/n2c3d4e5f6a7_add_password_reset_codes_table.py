"""add password_reset_codes table

Revision ID: n2c3d4e5f6a7
Revises: m1b2c3d4e5f6
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'n2c3d4e5f6a7'
down_revision = 'm1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'passwordresetcode',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('email', sa.String(), nullable=False, index=True),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_passwordresetcode_email', 'passwordresetcode', ['email'])


def downgrade() -> None:
    op.drop_index('ix_passwordresetcode_email', table_name='passwordresetcode')
    op.drop_table('passwordresetcode')
