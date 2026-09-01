"""Add eSewa/Khalti QR url columns to worker_profiles

Revision ID: module6_payment_qr
Revises: module5_password_reset
Create Date: 2026-07-04
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'module6_payment_qr'
down_revision = 'module5_password_reset'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('worker_profiles', sa.Column('esewa_qr_url', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('khalti_qr_url', sa.String(), nullable=True))


def downgrade():
    op.drop_column('worker_profiles', 'khalti_qr_url')
    op.drop_column('worker_profiles', 'esewa_qr_url')
