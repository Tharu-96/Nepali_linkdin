"""Add the internal worker wallet credit ledger.

Revision ID: module7_worker_wallet
Revises: module6_payment_qr
Create Date: 2026-08-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "module7_worker_wallet"
down_revision = "module6_payment_qr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "worker_wallet_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("worker_id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount_npr", sa.Numeric(), nullable=False),
        sa.Column("entry_type", sa.String(), server_default="credit", nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["worker_id"], ["worker_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transaction_id", name="uq_worker_wallet_transaction"),
    )
    op.create_index("ix_worker_wallet_entries_worker_id", "worker_wallet_entries", ["worker_id"])
    op.create_index("ix_worker_wallet_entries_transaction_id", "worker_wallet_entries", ["transaction_id"])


def downgrade() -> None:
    op.drop_index("ix_worker_wallet_entries_transaction_id", table_name="worker_wallet_entries")
    op.drop_index("ix_worker_wallet_entries_worker_id", table_name="worker_wallet_entries")
    op.drop_table("worker_wallet_entries")
