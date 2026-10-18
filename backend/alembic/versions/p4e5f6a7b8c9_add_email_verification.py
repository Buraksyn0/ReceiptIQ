"""add email verification (user.email_verified + emailverificationcode table)

Revision ID: p4e5f6a7b8c9
Revises: o3d4e5f6a7b8
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'p4e5f6a7b8c9'
down_revision = 'o3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Mevcut hesaplar doğrulanmış sayılır (App Review demo hesabı kod isteyip
    # giriş yapamaz hale gelmesin). Yeni kayıtlar için varsayılan 'false'.
    op.add_column(
        'user',
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='true'),
    )
    op.alter_column('user', 'email_verified', server_default='false')

    op.create_table(
        'emailverificationcode',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('email', sa.String(), nullable=False, index=True),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('emailverificationcode')
    op.drop_column('user', 'email_verified')
