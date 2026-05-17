"""add_recurring_transactions_table

Revision ID: i7d8e9f0a1b2
Revises: 511dd71bfaba
Create Date: 2026-05-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i7d8e9f0a1b2'
down_revision: Union[str, None] = '511dd71bfaba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'recurringtransaction',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('merchant_name', sa.String(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('category', sa.String(), nullable=False, server_default='other'),
        sa.Column('receipt_type', sa.String(), nullable=False, server_default='expense'),
        sa.Column('frequency', sa.String(), nullable=False, server_default='monthly'),
        sa.Column('next_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('recurringtransaction')
