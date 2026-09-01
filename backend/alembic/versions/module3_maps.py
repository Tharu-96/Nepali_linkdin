"""Add map/location columns to jobs, worker_profiles, employer_profiles

Revision ID: module3_maps
Revises: module2_payments
Create Date: 2026-06-23 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'module3_maps'
down_revision = 'module2_payments'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add map_address to jobs
    op.add_column('jobs', sa.Column('map_address', sa.String(), nullable=True))

    # Add location_sharing_consent to worker_profiles
    op.add_column('worker_profiles', sa.Column('location_sharing_consent', sa.Boolean(), server_default=sa.text('false'), nullable=False))

    # Add latitude, longitude, office_address to employer_profiles
    op.add_column('employer_profiles', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('employer_profiles', sa.Column('longitude', sa.Float(), nullable=True))
    op.add_column('employer_profiles', sa.Column('office_address', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('employer_profiles', 'office_address')
    op.drop_column('employer_profiles', 'longitude')
    op.drop_column('employer_profiles', 'latitude')
    op.drop_column('worker_profiles', 'location_sharing_consent')
    op.drop_column('jobs', 'map_address')
