"""Module 4: Reviews and Ratings system

Revision ID: module4_reviews
Revises: module3_maps
Create Date: 2026-06-27
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'module4_reviews'
down_revision = 'module3_maps'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reviews',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reviewer_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reviewee_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reviewer_role', sa.String(), nullable=False),       # 'employer' or 'worker'
        sa.Column('overall_rating', sa.Integer(), nullable=False),     # 1-5
        # Worker-side categories (filled when reviewer_role == 'employer')
        sa.Column('punctuality', sa.Integer(), nullable=True),
        sa.Column('work_quality', sa.Integer(), nullable=True),
        sa.Column('communication', sa.Integer(), nullable=True),
        sa.Column('attitude', sa.Integer(), nullable=True),
        # Employer-side categories (filled when reviewer_role == 'worker')
        sa.Column('payment_timeliness', sa.Integer(), nullable=True),
        sa.Column('work_environment', sa.Integer(), nullable=True),
        sa.Column('fairness', sa.Integer(), nullable=True),
        sa.Column('written_feedback', sa.Text(), nullable=True),       # min 20, max 500 chars
        sa.Column('is_anonymous', sa.Boolean(), default=False, nullable=False, server_default='false'),
        sa.Column('is_flagged', sa.Boolean(), default=False, nullable=False, server_default='false'),
        sa.Column('is_deleted', sa.Boolean(), default=False, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        # Enforce one review per reviewer per job
        sa.UniqueConstraint('job_id', 'reviewer_id', name='uq_reviews_job_reviewer'),
    )
    op.create_index('ix_reviews_job_id', 'reviews', ['job_id'])
    op.create_index('ix_reviews_reviewer_id', 'reviews', ['reviewer_id'])
    op.create_index('ix_reviews_reviewee_id', 'reviews', ['reviewee_id'])


def downgrade():
    op.drop_index('ix_reviews_reviewee_id', table_name='reviews')
    op.drop_index('ix_reviews_reviewer_id', table_name='reviews')
    op.drop_index('ix_reviews_job_id', table_name='reviews')
    op.drop_table('reviews')
