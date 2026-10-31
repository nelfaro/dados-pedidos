import { NextResponse } from 'next/server';
import { asegurarEsquema, pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await asegurarEsquema();
  const { rows } = await pool.query(`
    SELECT numero_pedido, session_id, canal, cliente_nombre, items, total,
           cantidad_items, estado,
           to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS fecha,
           to_char(updated_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS actualizado
    FROM pedidos
    WHERE estado <> 'cancelado'
    ORDER BY created_at DESC
    LIMIT 300
  `);

  const pedidos = rows.map((p) => {
    const items = typeof p.items === 'string' ? JSON.parse(p.items || '[]') : p.items || [];
    return {
      numero_pedido: p.numero_pedido,
      canal: p.canal,
      contacto: p.session_id, // WhatsApp: numero. Telegram: 'tg:<id>'
      cliente: p.cliente_nombre || 'Cliente',
      items,
      total: Number(p.total) || 0,
      cantidad_items: Number(p.cantidad_items) || 0,
      estado: p.estado,
      fecha: p.fecha,
      actualizado: p.actualizado,
    };
  });
  return NextResponse.json({ pedidos });
}
