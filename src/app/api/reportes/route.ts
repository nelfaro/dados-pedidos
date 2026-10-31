import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';
import { parseItems, TZ } from '@/lib/pedidos';
import { esEstadoFlujo } from '@/lib/estados';

export const dynamic = 'force-dynamic';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const a = await autorizar();
  if ('error' in a) return a.error;

  const q = req.nextUrl.searchParams;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const hace30 = new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: TZ });
  const desde = FECHA.test(q.get('desde') || '') ? q.get('desde')! : hace30;
  const hasta = FECHA.test(q.get('hasta') || '') ? q.get('hasta')! : hoy;
  const estadoParam = q.get('estado') || 'todos';
  const estado = esEstadoFlujo(estadoParam) ? estadoParam : null;

  let rows;
  try {
    ({ rows } = await pool.query(
      `SELECT p.numero_pedido, p.canal, p.session_id, p.cliente_nombre, p.items, p.total,
              p.estado, p.nota_staff,
              to_char(p.created_at AT TIME ZONE $1,'DD/MM/YYYY HH24:MI') AS fecha,
              (SELECT string_agg(DISTINCT h.usuario, ', ') FROM pedido_historial h
                 WHERE h.numero_pedido = p.numero_pedido) AS gestionado_por,
              (SELECT to_char(max(h.created_at) AT TIME ZONE $1,'DD/MM/YYYY HH24:MI') FROM pedido_historial h
                 WHERE h.numero_pedido = p.numero_pedido) AS ultimo_movimiento
       FROM pedidos p
       WHERE p.estado <> 'cancelado'
         AND (p.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
         AND ($4::text IS NULL OR p.estado = $4::text)
       ORDER BY p.created_at DESC
       LIMIT 2000`,
      [TZ, desde, hasta, estado]
    ));
  } catch {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
  }

  const pedidos = rows.map((p) => ({
    numero_pedido: p.numero_pedido,
    fecha: p.fecha,
    cliente: p.cliente_nombre || 'Cliente',
    contacto: p.canal === 'telegram' ? 'Telegram' : p.session_id,
    items: parseItems(p.items),
    total: Number(p.total) || 0,
    estado: p.estado,
    nota: p.nota_staff || '',
    gestionado_por: p.gestionado_por || '',
    ultimo_movimiento: p.ultimo_movimiento || '',
  }));
  return NextResponse.json({ desde, hasta, estado: estado ?? 'todos', pedidos });
}
