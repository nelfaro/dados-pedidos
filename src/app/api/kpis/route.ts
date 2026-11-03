import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';
import { parseItems, redondear, TZ } from '@/lib/pedidos';

export const dynamic = 'force-dynamic';

const PERIODOS = [7, 30, 90];
const COBRADOS = "estado IN ('pagado','listo','entregado')";

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

function restarDias(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const a = await autorizar();
  if ('error' in a) return a.error;

  const pedido = Number(req.nextUrl.searchParams.get('dias'));
  const dias = PERIODOS.includes(pedido) ? pedido : 30;
  const fechas = ultimosDias(dias);
  const desde = fechas[0];
  const desdePrevio = restarDias(desde, dias);

  const [pipe, periodo, canc, creados, movs, tiempos, usuarios, previo, vendidos] = await Promise.all([
    pool.query(
      `SELECT estado, count(*)::int AS n, coalesce(sum(total),0)::float8 AS monto
       FROM pedidos WHERE estado <> 'cancelado' GROUP BY estado`
    ),
    pool.query(
      `SELECT count(*)::int AS creados,
              coalesce(sum(total),0)::float8 AS monto,
              count(*) FILTER (WHERE ${COBRADOS})::int AS cobrados,
              coalesce(sum(total) FILTER (WHERE ${COBRADOS}),0)::float8 AS monto_cobrado
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
    // Periodo anterior de la misma duracion, para mostrar la variacion.
    pool.query(
      `SELECT count(*)::int AS creados,
              coalesce(sum(total),0)::float8 AS monto,
              count(*) FILTER (WHERE ${COBRADOS})::int AS cobrados,
              coalesce(sum(total) FILTER (WHERE ${COBRADOS}),0)::float8 AS monto_cobrado
       FROM pedidos
       WHERE estado <> 'cancelado'
         AND (created_at AT TIME ZONE $1)::date >= $2::date
         AND (created_at AT TIME ZONE $1)::date < $3::date`,
      [TZ, desdePrevio, desde]
    ),
    pool.query(
      `SELECT items FROM pedidos
       WHERE estado <> 'cancelado' AND (created_at AT TIME ZONE $1)::date >= $2::date
       LIMIT 3000`,
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

  // Productos mas vendidos del periodo (se agrupa por nombre, sin distinguir mayusculas).
  const productos = new Map<string, { nombre: string; cantidad: number; ingreso: number }>();
  for (const fila of vendidos.rows) {
    for (const it of parseItems(fila.items)) {
      const nombre = String(it.nombre || '').trim();
      if (!nombre) continue;
      const cantidad = Number(it.cantidad) || 0;
      const linea = Number(it.total_linea) || cantidad * (Number(it.precio_unit) || 0);
      const p = productos.get(nombre.toLowerCase()) ?? { nombre, cantidad: 0, ingreso: 0 };
      p.cantidad += cantidad;
      p.ingreso += linea;
      productos.set(nombre.toLowerCase(), p);
    }
  }
  const topProductos = [...productos.values()]
    .sort((x, y) => y.ingreso - x.ingreso)
    .slice(0, 6)
    .map((p) => ({ ...p, ingreso: redondear(p.ingreso) }));

  return NextResponse.json({
    dias,
    pipeline,
    periodo: { ...periodo.rows[0], cancelados: canc.rows[0].n },
    previo: previo.rows[0],
    topProductos,
    serie: fechas.map((f) => ({ dia: f, ...mapa.get(f) })),
    tiempos: tiempos.rows[0],
    usuarios: usuarios.rows,
  });
}
