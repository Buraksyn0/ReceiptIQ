"""add tag and receipt_tag tables

Revision ID: m1b2c3d4e5f6
Revises: l0a1b2c3d4e5
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'm1b2c3d4e5f6'
down_revision = 'l0a1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tag',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('color', sa.String(7), nullable=False, server_default='#00A878'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_tag_user_id', 'tag', ['user_id'])

    op.create_table(
        'receipt_tag',
        sa.Column('receipt_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('receipt.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tag.id', ondelete='CASCADE'), primary_key=True),
    )


def downgrade():
    op.drop_table('receipt_tag')
    op.drop_index('ix_tag_user_id', table_name='tag')
    op.drop_table('tag')
