"""initial_schema_with_metric_snapshots

Revision ID: 357a3c341514
Revises:
Create Date: 2026-09-04 11:52:23.627513

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '357a3c341514'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'templates' in tables:
        with op.batch_alter_table('templates') as batch_op:
            batch_op.alter_column(
                'extraction',
                existing_type=sa.TEXT(),
                type_=sa.JSON(),
                existing_nullable=True,
            )

    if 'metric_snapshots' not in tables:
        op.create_table(
            'metric_snapshots',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('business_id', sa.String(), sa.ForeignKey('businesses.id'), nullable=False, index=True),
            sa.Column('snapshot_date', sa.DateTime(), nullable=False, index=True),
            sa.Column('avg_documentation_time_mins', sa.Float(), default=0.0),
            sa.Column('avg_accuracy_pct', sa.Float(), default=0.0),
            sa.Column('compliance_rate_pct', sa.Float(), default=100.0),
            sa.Column('total_jobs_completed', sa.Integer(), default=0),
            sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'metric_snapshots' in tables:
        op.drop_table('metric_snapshots')

    if 'templates' in tables:
        with op.batch_alter_table('templates') as batch_op:
            batch_op.alter_column(
                'extraction',
                existing_type=sa.JSON(),
                type_=sa.TEXT(),
                existing_nullable=True,
            )
