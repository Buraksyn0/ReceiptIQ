"""add uploaded_files table and receipt.source_file_id

Revision ID: a91c4b2e7d18
Revises: cefa8b447d36
Create Date: 2026-04-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a91c4b2e7d18"
down_revision: Union[str, None] = "cefa8b447d36"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. uploaded_files tablosu
    op.create_table(
        "uploaded_files",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("mime_type", sa.String(length=50), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("ocr_provider", sa.String(length=30), nullable=True),
        sa.Column("ocr_confidence", sa.Float(), nullable=True),
        sa.Column("parsed_data", sa.JSON(), nullable=True),
        sa.Column("receipt_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["receipt_id"], ["receipt.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_uploaded_files_user_id", "uploaded_files", ["user_id"], unique=False
    )
    op.create_index(
        "ix_uploaded_files_sha256", "uploaded_files", ["sha256"], unique=False
    )

    # 2. Receipt'e source_file_id ekle
    op.add_column(
        "receipt", sa.Column("source_file_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        "fk_receipt_source_file",
        "receipt",
        "uploaded_files",
        ["source_file_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_receipt_source_file", "receipt", type_="foreignkey")
    op.drop_column("receipt", "source_file_id")

    op.drop_index("ix_uploaded_files_sha256", table_name="uploaded_files")
    op.drop_index("ix_uploaded_files_user_id", table_name="uploaded_files")
    op.drop_table("uploaded_files")
