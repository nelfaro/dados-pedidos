import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';
import { parseItems, TZ } from '@/lib/pedidos';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await autorizar();
  if ('error' in a) return a.error;

  // Los entregados solo se muestran la ultima semana; el historial completo esta en Reportes.
  const { rows } = await pool.query(
    `
    SELECT numero_pedido, session_id, canal, cliente_nombre, items, total,
           cantidad_items, estado, nota_staff,
           to_char(created_at AT TIME ZONE $1,'DD/MM HH24:MI') AS fecha,
           to_char(updated_at AT TIME ZONE $1,'DD/MM HH24:MI') AS actualizado
    FROM pedidos
    WHERE estado <> 'cancelado'
      AND (estado <> 'entregado' OR updated_at > now() - interval '7 days')
    ORDER BY created_at DESC
    LIMIT 400
  `,
    [TZ]
  );

  const pedidos = rows.map((p) => ({
    numero_pedido: p.numero_pedido,
    canal: p.canal,
    contacto: p.session_id, // WhatsApp: numero. Telegram: 'tg:<id>'
    cliente: p.cliente_nombre || 'Cliente',
    items: parseItems(p.items),
    total: Number(p.total) || 0,
    cantidad_items: Number(p.cantidad_items) || 0,
    estado: p.estado,
    nota: p.nota_staff || '',
    fecha: p.fecha,
    actualizado: p.actualizado,
  }));
  return NextResponse.json({ pedidos });
}
