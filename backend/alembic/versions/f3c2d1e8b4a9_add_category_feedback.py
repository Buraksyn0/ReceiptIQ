"""add_category_feedback

Revision ID: f3c2d1e8b4a9
Revises: a91c4b2e7d18
Create Date: 2026-04-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f3c2d1e8b4a9'
down_revision: Union[str, None] = 'a91c4b2e7d18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'category_feedback',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.UUID(as_uuid=True),
                  sa.ForeignKey('user.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('upload_id', sa.UUID(as_uuid=True),
                  sa.ForeignKey('uploaded_files.id', ondelete='SET NULL'),
                  nullable=True, index=True),
        sa.Column('receipt_id', sa.UUID(as_uuid=True),
                  sa.ForeignKey('receipt.id', ondelete='SET NULL'),
                  nullable=True, index=True),
        sa.Column('suggested_category', sa.String(50), nullable=True),
        sa.Column('selected_category', sa.String(50), nullable=False),
        sa.Column('ocr_text', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('category_feedback')
