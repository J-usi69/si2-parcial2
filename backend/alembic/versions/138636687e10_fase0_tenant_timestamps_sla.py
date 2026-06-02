"""fase0 tenant timestamps sla

Revision ID: 138636687e10
Revises: 4d68bd14e74f
Create Date: 2026-06-01 23:15:28.903521

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '138636687e10'
down_revision: Union[str, Sequence[str], None] = '4d68bd14e74f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Estrategia para no romper filas existentes: las columnas tenant_id que en
    el modelo son NOT NULL (workshops, technicians, service_offers) se agregan
    primero como NULLABLE, se backfillean (un tenant por taller existente) y
    recien entonces se marcan NOT NULL.
    """
    # 1) Tablas nuevas -------------------------------------------------------
    op.create_table('tenants',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('slug', sa.String(length=120), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('contact_email', sa.String(length=255), nullable=True),
    sa.Column('contact_phone', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tenants_id'), 'tenants', ['id'], unique=False)
    op.create_index(op.f('ix_tenants_slug'), 'tenants', ['slug'], unique=True)
    op.create_table('service_category_sla',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=True),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('expected_assignment_min', sa.Integer(), nullable=False),
    sa.Column('expected_arrival_min', sa.Integer(), nullable=False),
    sa.Column('expected_completion_min', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tenant_id', 'category', name='uq_sla_tenant_category')
    )
    op.create_index(op.f('ix_service_category_sla_id'), 'service_category_sla', ['id'], unique=False)

    # 2) Columnas nuevas (todas NULLABLE por ahora) -------------------------
    op.add_column('incidents', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.add_column('incidents', sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('incidents', sa.Column('en_route_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('incidents', sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('incidents', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('incidents', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('incidents', sa.Column('cancel_reason', sa.String(length=500), nullable=True))
    op.create_index(op.f('ix_incidents_tenant_id'), 'incidents', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_incidents_tenant_id', 'incidents', 'tenants', ['tenant_id'], ['id'])

    op.add_column('service_offers', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_service_offers_tenant_id'), 'service_offers', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_service_offers_tenant_id', 'service_offers', 'tenants', ['tenant_id'], ['id'])

    op.add_column('technicians', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_technicians_tenant_id'), 'technicians', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_technicians_tenant_id', 'technicians', 'tenants', ['tenant_id'], ['id'])

    op.add_column('users', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_users_tenant_id'), 'users', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_users_tenant_id', 'users', 'tenants', ['tenant_id'], ['id'])

    op.add_column('workshops', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_workshops_tenant_id'), 'workshops', ['tenant_id'], unique=True)
    op.create_foreign_key('fk_workshops_tenant_id', 'workshops', 'tenants', ['tenant_id'], ['id'])

    # 3) Backfill: un Tenant 1:1 por cada taller existente ------------------
    op.execute("""
        INSERT INTO tenants (name, slug, is_active, contact_phone, created_at)
        SELECT w.name, 'taller-' || w.id, true, w.phone, now()
        FROM workshops w
    """)
    op.execute("""
        UPDATE workshops w SET tenant_id = t.id
        FROM tenants t WHERE t.slug = 'taller-' || w.id
    """)
    op.execute("""
        UPDATE technicians te SET tenant_id = w.tenant_id
        FROM workshops w WHERE te.workshop_id = w.id
    """)
    op.execute("""
        UPDATE service_offers so SET tenant_id = w.tenant_id
        FROM workshops w WHERE so.workshop_id = w.id
    """)
    # usuarios duenos de taller
    op.execute("""
        UPDATE users u SET tenant_id = w.tenant_id
        FROM workshops w WHERE w.user_id = u.id
    """)
    # usuarios tecnicos
    op.execute("""
        UPDATE users u SET tenant_id = te.tenant_id
        FROM technicians te WHERE te.user_id = u.id AND te.user_id IS NOT NULL
    """)
    # incidentes ya asignados a un taller
    op.execute("""
        UPDATE incidents i SET tenant_id = w.tenant_id
        FROM workshops w WHERE i.workshop_id = w.id
    """)

    # 4) Ahora si: marcar NOT NULL las columnas que lo requieren ------------
    op.alter_column('workshops', 'tenant_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('technicians', 'tenant_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('service_offers', 'tenant_id', existing_type=sa.Integer(), nullable=False)

    # 5) SLA por defecto (global, tenant_id NULL) por categoria -------------
    op.execute("""
        INSERT INTO service_category_sla
            (tenant_id, category, expected_assignment_min, expected_arrival_min, expected_completion_min, created_at)
        VALUES
            (NULL, 'battery',   10, 25,  45, now()),
            (NULL, 'tire',      10, 25,  40, now()),
            (NULL, 'crash',     10, 30, 120, now()),
            (NULL, 'engine',    10, 35, 120, now()),
            (NULL, 'keys',      10, 20,  40, now()),
            (NULL, 'other',     10, 30,  90, now()),
            (NULL, 'uncertain', 10, 30,  90, now())
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('fk_workshops_tenant_id', 'workshops', type_='foreignkey')
    op.drop_index(op.f('ix_workshops_tenant_id'), table_name='workshops')
    op.drop_column('workshops', 'tenant_id')
    op.drop_constraint('fk_users_tenant_id', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_tenant_id'), table_name='users')
    op.drop_column('users', 'tenant_id')
    op.drop_constraint('fk_technicians_tenant_id', 'technicians', type_='foreignkey')
    op.drop_index(op.f('ix_technicians_tenant_id'), table_name='technicians')
    op.drop_column('technicians', 'tenant_id')
    op.drop_constraint('fk_service_offers_tenant_id', 'service_offers', type_='foreignkey')
    op.drop_index(op.f('ix_service_offers_tenant_id'), table_name='service_offers')
    op.drop_column('service_offers', 'tenant_id')
    op.drop_constraint('fk_incidents_tenant_id', 'incidents', type_='foreignkey')
    op.drop_index(op.f('ix_incidents_tenant_id'), table_name='incidents')
    op.drop_column('incidents', 'cancel_reason')
    op.drop_column('incidents', 'cancelled_at')
    op.drop_column('incidents', 'completed_at')
    op.drop_column('incidents', 'arrived_at')
    op.drop_column('incidents', 'en_route_at')
    op.drop_column('incidents', 'assigned_at')
    op.drop_column('incidents', 'tenant_id')
    op.drop_index(op.f('ix_service_category_sla_id'), table_name='service_category_sla')
    op.drop_table('service_category_sla')
    op.drop_index(op.f('ix_tenants_slug'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_id'), table_name='tenants')
    op.drop_table('tenants')
    # ### end Alembic commands ###
