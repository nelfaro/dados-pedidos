import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';
import { leerConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Derivaciones pendientes: el cliente esta esperando a un vendedor y el bot esta silenciado.
export async function GET() {
  const a = await autorizar();
  if ('error' in a) return a.error;

  const cfg = await leerConfig();
  const { rows } = await pool.query(
    `SELECT id, session_id, canal, cliente_nombre AS cliente, motivo, resumen, detalle,
            to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS hora,
            EXTRACT(EPOCH FROM (now() - created_at))::int AS espera_seg
     FROM atencion_humana
     WHERE estado = 'pendiente' AND created_at > now() - make_interval(hours => $1::int)
     ORDER BY created_at`,
    [cfg.derivacion.vencimiento_horas]
  );
  return NextResponse.json({ pendientes: rows, vencimiento_horas: cfg.derivacion.vencimiento_horas });
}
