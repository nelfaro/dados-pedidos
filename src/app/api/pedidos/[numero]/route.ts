import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';
import { ESTADO_EDITABLE } from '@/lib/estados';
import { parseItems, redondear, type Item } from '@/lib/pedidos';

// Modifica los productos de un pedido que todavia no fue cobrado (por ejemplo por falta de stock).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ numero: string }> }) {
  const a = await autorizar();
  if ('error' in a) return a.error;

  const { numero } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const motivo = String(body.motivo || '').trim().slice(0, 300);

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return NextResponse.json({ error: 'El pedido debe tener entre 1 y 50 productos' }, { status: 400 });
  }

  const items: Item[] = [];
  for (const it of body.items) {
    const nombre = String(it?.nombre || '').trim().slice(0, 200);
    const cantidad = Number(it?.cantidad);
    const precio = Number(it?.precio_unit);
    if (!nombre || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 9999) {
      return NextResponse.json({ error: 'Revisá nombre y cantidad de cada producto' }, { status: 400 });
    }
    if (!Number.isFinite(precio) || precio < 0 || precio > 1e9) {
      return NextResponse.json({ error: 'Revisá el precio de cada producto' }, { status: 400 });
    }
    items.push({
      ...it,
      idx: items.length + 1, // el bot numera las lineas de 1 a N
      nombre,
      cantidad,
      precio_unit: precio,
      total_linea: redondear(cantidad * precio),
    });
  }
  const total = redondear(items.reduce((s, i) => s + i.total_linea, 0));

  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const { rows } = await cli.query(
      'SELECT estado, items, cantidad_items FROM pedidos WHERE numero_pedido = $1 FOR UPDATE',
      [numero]
    );
    if (!rows[0]) {
      await cli.query('ROLLBACK');
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    const { estado } = rows[0];
    if (estado !== ESTADO_EDITABLE) {
      await cli.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Solo se puede modificar un pedido que todavía no fue cobrado', estado },
        { status: 409 }
      );
    }

    // cantidad_items: se respeta la convencion del bot (unidades o lineas) segun como venia el pedido.
    const antes = parseItems(rows[0].items);
    const unidadesAntes = antes.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
    const contabaLineas = Number(rows[0].cantidad_items) === antes.length && antes.length !== unidadesAntes;
    const cantidadItems = contabaLineas ? items.length : items.reduce((s, i) => s + i.cantidad, 0);

    await cli.query(
      `UPDATE pedidos
         SET items = $2, total = $3, cantidad_items = $4,
             nota_staff = COALESCE($5::text, nota_staff), updated_at = now()
       WHERE numero_pedido = $1`,
      [numero, JSON.stringify(items), total, cantidadItems, motivo || null]
    );
    await cli.query(
      `INSERT INTO pedido_historial (numero_pedido, estado_anterior, estado_nuevo, usuario, detalle)
       VALUES ($1, $2, $2, $3, $4)`,
      [numero, estado, a.sesion.usuario, JSON.stringify({ motivo, antes, despues: items })]
    );
    await cli.query('COMMIT');
    return NextResponse.json({ ok: true, total, cantidad_items: cantidadItems });
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    console.error(e);
    return NextResponse.json({ error: 'Error al guardar los cambios' }, { status: 500 });
  } finally {
    cli.release();
  }
}
