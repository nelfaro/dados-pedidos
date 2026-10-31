import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';
import { TZ } from '@/lib/pedidos';

export const dynamic = 'force-dynamic';

const PERIODOS = [7, 30, 90];

// Lista de fechas YYYY-MM-DD desde hace (dias-1) hasta hoy, en hora argentina.
function ultimosDias(dias: number): string[] {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const base = new Date(`${hoy}T00:00:00Z`);
  const out: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    out.push(new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

export async function GET(req: NextRequest) {
  const a = await autorizar();
  if ('error' in a) return a.error;

  const pedido = Number(req.nextUrl.searchParams.get('dias'));
  const dias = PERIODOS.includes(pedido) ? pedido : 30;
  const fechas = ultimosDias(dias);
  const desde = fechas[0];

  const [pipe, periodo, canc, creados, movs, tiempos, usuarios] = await Promise.all([
    pool.query(
      `SELECT estado, count(*)::int AS n, coalesce(sum(total),0)::float8 AS monto
       FROM pedidos WHERE estado <> 'cancelado' GROUP BY estado`
    ),
    pool.query(
      `SELECT count(*)::int AS creados,
              coalesce(sum(total),0)::float8 AS monto,
              count(*) FILTER (WHERE estado IN ('pagado','listo','entregado'))::int AS cobrados,
              coalesce(sum(total) FILTER (WHERE estado IN ('pagado','listo','entregado')),0)::float8 AS monto_cobrado
       FROM pedidos
       WHERE estado <> 'cancelado' AND (created_at AT TIME ZONE $1)::date >= $2::date`,
      [TZ, desde]
    ),
    pool.query(
      `SELECT count(*)::int AS n FROM pedidos
       WHERE estado = 'cancelado' AND (created_at AT TIME ZONE $1)::date >= $2::date`,
      [TZ, desde]
    ),
    pool.query(
      `SELECT to_char((created_at AT TIME ZONE $1)::date,'YYYY-MM-DD') AS dia, count(*)::int AS n
       FROM pedidos
       WHERE estado <> 'cancelado' AND (created_at AT TIME ZONE $1)::date >= $2::date
       GROUP BY 1`,
      [TZ, desde]
    ),
    pool.query(
      `SELECT to_char((created_at AT TIME ZONE $1)::date,'YYYY-MM-DD') AS dia, estado_nuevo AS estado, count(*)::int AS n
       FROM pedido_historial
       WHERE estado_anterior IS DISTINCT FROM estado_nuevo
         AND (created_at AT TIME ZONE $1)::date >= $2::date
       GROUP BY 1, 2`,
      [TZ, desde]
    ),
    pool.query(
      `WITH h AS (
         SELECT numero_pedido,
                min(created_at) FILTER (WHERE estado_nuevo = 'pagado')    AS t_pagado,
                min(created_at) FILTER (WHERE estado_nuevo = 'listo')     AS t_listo,
                min(created_at) FILTER (WHERE estado_nuevo = 'entregado') AS t_entregado
         FROM pedido_historial GROUP BY numero_pedido
       )
       SELECT
         avg(extract(epoch FROM (h.t_pagado - p.created_at))) FILTER (WHERE h.t_pagado > p.created_at)::float8 AS a_cobro,
         avg(extract(epoch FROM (h.t_listo - h.t_pagado)))    FILTER (WHERE h.t_listo > h.t_pagado)::float8 AS a_listo,
         avg(extract(epoch FROM (h.t_entregado - h.t_listo))) FILTER (WHERE h.t_entregado > h.t_listo)::float8 AS a_entrega
       FROM pedidos p JOIN h USING (numero_pedido)
       WHERE (p.created_at AT TIME ZONE $1)::date >= $2::date`,
      [TZ, desde]
    ),
    pool.query(
      `SELECT usuario,
              count(*) FILTER (WHERE estado_anterior IS DISTINCT FROM estado_nuevo)::int AS movimientos,
              count(*) FILTER (WHERE estado_anterior IS NOT DISTINCT FROM estado_nuevo)::int AS ediciones
       FROM pedido_historial
       WHERE (created_at AT TIME ZONE $1)::date >= $2::date
       GROUP BY usuario ORDER BY 2 DESC, 1`,
      [TZ, desde]
    ),
  ]);

  const mapa = new Map<string, Record<string, number>>();
  for (const f of fechas) mapa.set(f, { nuevos: 0, pagado: 0, listo: 0, entregado: 0 });
  for (const r of creados.rows) {
    const d = mapa.get(r.dia);
    if (d) d.nuevos = r.n;
  }
  for (const r of movs.rows) {
    const d = mapa.get(r.dia);
    if (d && r.estado in d) d[r.estado] = r.n;
  }

  const pipeline: Record<string, { n: number; monto: number }> = {};
  for (const r of pipe.rows) pipeline[r.estado] = { n: r.n, monto: r.monto };

  return NextResponse.json({
    dias,
    pipeline,
    periodo: { ...periodo.rows[0], cancelados: canc.rows[0].n },
    serie: fechas.map((f) => ({ dia: f, ...mapa.get(f) })),
    tiempos: tiempos.rows[0],
    usuarios: usuarios.rows,
  });
}
