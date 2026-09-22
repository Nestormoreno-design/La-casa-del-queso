"""ronda mvp: estados unificados, conductor, credito, categoria cliente

Revision ID: 9b3c1a7e2f10
Revises: d4e5f6a7b8c9
"""

revision = "9b3c1a7e2f10"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    import sqlalchemy as sa

    # 1) pedidos.conductor_id (conductor responsable, nullable para no romper datos)
    op.add_column("pedidos", sa.Column("conductor_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_pedidos_conductor", "pedidos", "usuarios", ["conductor_id"], ["id"])

    # 2) pedidos.estado: ampliar a 30 para tildes/espacios ("EN DISTRIBUCIÓN")
    op.alter_column("pedidos", "estado", existing_type=sa.String(length=20),
                    type_=sa.String(length=30), existing_nullable=False)

    # 3) clientes.tipo_cliente: default MINORISTA para registros existentes
    op.execute("UPDATE clientes SET tipo_cliente='MINORISTA' WHERE tipo_cliente IS NULL OR tipo_cliente=''")
    op.execute("UPDATE clientes SET tipo_cliente='MAYORISTA' WHERE upper(tipo_cliente) IN ('DISTRIBUIDOR','DISTRIBUCION','DISTRIBUCIÓN','MAYORISTA')")
    op.execute("UPDATE clientes SET tipo_cliente='MINORISTA' WHERE upper(tipo_cliente) IN ('MINORISTA','MOSTRADOR','DETAL','MENUDEO')")

    # 4) Normalizar estados de pedidos a la nomenclatura única
    op.execute("UPDATE pedidos SET estado='EN PREPARACIÓN' WHERE estado IN ('PREPARANDO','EN_PREPARACION','PREPARACION','EN PREPARACION')")
    op.execute("UPDATE pedidos SET estado='EN DISTRIBUCIÓN' WHERE estado IN ('LISTO','PROGRAMADO','DESPACHADO')")
    # CANCELADO se elimina del flujo: los cerrados sin entrega pasan a DEVUELTO para conservar historial terminal
    op.execute("UPDATE pedidos SET estado='DEVUELTO' WHERE estado IN ('CANCELADO','CANCELADA')")

    # 5) Tabla de crédito simple (no contable)
    op.create_table(
        "creditos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id"), nullable=False, index=True),
        sa.Column("venta_id", sa.Integer(), sa.ForeignKey("ventas.id"), nullable=True),
        sa.Column("pedido_id", sa.Integer(), sa.ForeignKey("pedidos.id"), nullable=True),
        sa.Column("monto_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("saldo_pendiente", sa.Numeric(12, 2), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="PENDIENTE"),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "credito_abonos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("credito_id", sa.Integer(), sa.ForeignKey("creditos.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False),
        sa.Column("metodo_pago", sa.String(20), nullable=True),
        sa.Column("caja_sesion_id", sa.Integer(), sa.ForeignKey("caja_sesiones.id"), nullable=True),
        sa.Column("caja_movimiento_id", sa.Integer(), sa.ForeignKey("caja_movimientos.id"), nullable=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    from alembic import op
    import sqlalchemy as sa
    op.drop_table("credito_abonos")
    op.drop_table("creditos")
    op.execute("UPDATE pedidos SET estado='PREPARANDO' WHERE estado='EN PREPARACIÓN'")
    op.execute("UPDATE pedidos SET estado='LISTO' WHERE estado='EN DISTRIBUCIÓN'")
    op.execute("UPDATE pedidos SET estado='CANCELADO' WHERE estado='DEVUELTO'")
    op.drop_constraint("fk_pedidos_conductor", "pedidos", type_="foreignkey")
    op.drop_column("pedidos", "conductor_id")
    op.alter_column("pedidos", "estado", existing_type=sa.String(length=30),
                    type_=sa.String(length=20), existing_nullable=False)
