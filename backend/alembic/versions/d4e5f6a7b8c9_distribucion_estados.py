"""reordena estados de distribucion a PENDIENTE/PREPARANDO/LISTO/ENTREGADO/CANCELADO"""

revision = "d4e5f6a7b8c9"
down_revision = "fca87d3259bf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("UPDATE pedidos SET estado='PREPARANDO' WHERE estado IN ('EN_PREPARACION','PREPARACION')")
    op.execute("UPDATE pedidos SET estado='LISTO' WHERE estado IN ('PROGRAMADO','LISTO','DESPACHADO')")


def downgrade() -> None:
    from alembic import op
    op.execute("UPDATE pedidos SET estado='EN_PREPARACION' WHERE estado='PREPARANDO'")
    op.execute("UPDATE pedidos SET estado='PROGRAMADO' WHERE estado='LISTO'")
