import { NextRequest, NextResponse } from 'next/server';
import { asegurarEsquema, pool } from '@/lib/db';
import { sesionActual } from '@/lib/auth';
import { transicionValida } from '@/lib/estados';

export async function POST(req: NextRequest, ctx: { params: Promise<{ numero: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { numero } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const nuevo = String(body.estado || '');

  await asegurarEsquema();
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const { rows } = await cli.query(
      'SELECT estado FROM pedidos WHERE numero_pedido = $1 FOR UPDATE',
      [numero]
    );
    if (!rows[0]) {
      await cli.query('ROLLBACK');
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    const actual: string = rows[0].estado;
    if (!transicionValida(actual, nuevo)) {
      await cli.query('ROLLBACK');
      return NextResponse.json(
        { error: `No se puede pasar de "${actual}" a "${nuevo}"`, estado: actual },
        { status: 409 }
      );
    }
    await cli.query('UPDATE pedidos SET estado = $2, updated_at = now() WHERE numero_pedido = $1', [
      numero,
      nuevo,
    ]);
    await cli.query(
      'INSERT INTO pedido_historial (numero_pedido, estado_anterior, estado_nuevo, usuario) VALUES ($1,$2,$3,$4)',
      [numero, actual, nuevo, sesion.usuario]
    );
    await cli.query('COMMIT');
    return NextResponse.json({ ok: true, estado: nuevo });
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    console.error(e);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  } finally {
    cli.release();
  }
}
