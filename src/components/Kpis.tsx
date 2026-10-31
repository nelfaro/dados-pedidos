'use client';

import { useEffect, useState } from 'react';
import { ETIQUETA, FLUJO } from '@/lib/estados';

type Punto = { dia: string; nuevos: number; pagado: number; listo: number; entregado: number };
type Datos = {
  dias: number;
  pipeline: Record<string, { n: number; monto: number }>;
  periodo: { creados: number; monto: number; cobrados: number; monto_cobrado: number; cancelados: number };
  serie: Punto[];
  tiempos: { a_cobro: number | null; a_listo: number | null; a_entrega: number | null };
  usuarios: { usuario: string; movimientos: number; ediciones: number }[];
};

const SERIES: { clave: keyof Omit<Punto, 'dia'>; nombre: string; color: string }[] = [
  { clave: 'nuevos', nombre: 'Nuevos', color: 'var(--s1)' },
  { clave: 'pagado', nombre: 'Pasaron a Pagado', color: 'var(--s2)' },
  { clave: 'listo', nombre: 'Pasaron a Listo', color: 'var(--s3)' },
  { clave: 'entregado', nombre: 'Pasaron a Entregado', color: 'var(--s4)' },
];

const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function duracion(seg: number | null): string {
  if (seg == null) return '—';
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
const corto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Grafico({ serie }: { serie: Punto[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 260, ML = 34, MR = 12, MT = 12, MB = 28;
  const max = Math.max(4, ...serie.flatMap((p) => SERIES.map((s) => p[s.clave])));
  const tope = Math.ceil(max / 4) * 4;
  const x = (i: number) => ML + (serie.length === 1 ? 0 : (i * (W - ML - MR)) / (serie.length - 1));
  const y = (v: number) => MT + (1 - v / tope) * (H - MT - MB);
  const cada = Math.ceil(serie.length / 8);

  function mover(e: React.MouseEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * (W - ML - MR);
    setHover(Math.max(0, Math.min(serie.length - 1, Math.round((px / (W - ML - MR)) * (serie.length - 1)))));
  }

  const h = hover != null ? serie[hover] : null;
  return (
    <div className="grafico">
      <div className="leyenda">
        {SERIES.map((s) => (
          <span key={s.clave}><i style={{ background: s.color }} />{s.nombre}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Movimiento diario de pedidos por estado">
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (tope / 4) * t;
          return (
            <g key={t}>
              <line x1={ML} x2={W - MR} y1={y(v)} y2={y(v)} className="g-grid" />
              <text x={ML - 6} y={y(v) + 4} textAnchor="end" className="g-txt">{v}</text>
            </g>
          );
        })}
        {serie.map((p, i) =>
          i % cada === 0 ? (
            <text key={p.dia} x={x(i)} y={H - 8} textAnchor="middle" className="g-txt">{corto(p.dia)}</text>
          ) : null
        )}
        {SERIES.map((s) => (
          <polyline
            key={s.clave}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={serie.map((p, i) => `${x(i)},${y(p[s.clave])}`).join(' ')}
          />
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={MT} y2={H - MB} className="g-cruz" />
            {SERIES.map((s) => (
              <circle key={s.clave} cx={x(hover)} cy={y(serie[hover][s.clave])} r={4.5} fill={s.color} className="g-punto" />
            ))}
          </g>
        )}
        <rect
          x={ML}
          y={MT}
          width={W - ML - MR}
          height={H - MT - MB}
          fill="transparent"
          onMouseMove={mover}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {h && hover != null && (
        <div className="tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{corto(h.dia)}</b>
          {SERIES.map((s) => (
            <div key={s.clave}><i style={{ background: s.color }} />{s.nombre}: <b>{h[s.clave]}</b></div>
          ))}
        </div>
      )}
      <details className="tabla-det">
        <summary>Ver como tabla</summary>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr><th>Día</th>{SERIES.map((s) => <th key={s.clave} className="derecha">{s.nombre}</th>)}</tr>
            </thead>
            <tbody>
              {serie.map((p) => (
                <tr key={p.dia}>
                  <td>{corto(p.dia)}</td>
                  {SERIES.map((s) => <td key={s.clave} className="derecha">{p[s.clave]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function Kpis() {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setError('');
    fetch(`/api/kpis?dias=${dias}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (vivo) setD(j);
      })
      .catch(() => vivo && setError('No se pudieron cargar los KPIs.'));
    return () => {
      vivo = false;
    };
  }, [dias]);

  const p = d?.periodo;
  const maxPipe = d ? Math.max(1, ...FLUJO.map((e) => d.pipeline[e]?.n ?? 0)) : 1;

  return (
    <div className="wrap">
      <div className="barra">
        <h2 className="titulo">KPIs</h2>
        <div className="tabs">
          {[7, 30, 90].map((n) => (
            <button key={n} className="tab" aria-pressed={dias === n} onClick={() => setDias(n)}>
              Últimos {n} días
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!d && !error && <p className="vacio">Cargando…</p>}

      {d && p && (
        <>
          <div className="tiles">
            <div className="tile"><span>Pedidos nuevos</span><b>{p.creados}</b><small>{p.cancelados} cancelados</small></div>
            <div className="tile"><span>Cobrado</span><b>{peso.format(p.monto_cobrado)}</b><small>{p.cobrados} pedidos</small></div>
            <div className="tile">
              <span>Ticket promedio</span>
              <b>{p.creados ? peso.format(p.monto / p.creados) : '—'}</b>
              <small>sobre {peso.format(p.monto)}</small>
            </div>
            <div className="tile">
              <span>Tasa de cobro</span>
              <b>{p.creados ? `${Math.round((p.cobrados / p.creados) * 100)}%` : '—'}</b>
              <small>{p.cobrados} de {p.creados}</small>
            </div>
          </div>

          <section className="panel">
            <h3>Cómo se movieron los pedidos</h3>
            <Grafico serie={d.serie} />
          </section>

          <div className="dos">
            <section className="panel">
              <h3>Pipeline hoy</h3>
              <div className="embudo">
                {FLUJO.map((e) => {
                  const v = d.pipeline[e] ?? { n: 0, monto: 0 };
                  return (
                    <div className="embudo-fila" key={e}>
                      <span>{ETIQUETA[e]}</span>
                      <div className="barra-fondo"><div className="barra-val" style={{ width: `${(v.n / maxPipe) * 100}%` }} /></div>
                      <span className="q">{v.n} · {peso.format(v.monto)}</span>
                    </div>
                  );
                })}
              </div>
              {(d.pipeline.modificando?.n ?? 0) > 0 && (
                <p className="fecha">{d.pipeline.modificando.n} con el cliente editando (aún sin confirmar).</p>
              )}
            </section>

            <section className="panel">
              <h3>Tiempos promedio entre etapas</h3>
              <dl className="tiempos">
                <div><dt>Pedido → Pagado</dt><dd>{duracion(d.tiempos.a_cobro)}</dd></div>
                <div><dt>Pagado → Listo</dt><dd>{duracion(d.tiempos.a_listo)}</dd></div>
                <div><dt>Listo → Entregado</dt><dd>{duracion(d.tiempos.a_entrega)}</dd></div>
              </dl>
            </section>
          </div>

          <section className="panel">
            <h3>Actividad por persona</h3>
            {d.usuarios.length === 0 ? (
              <p className="fecha">Todavía no hay movimientos en este período.</p>
            ) : (
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr><th>Usuario</th><th className="derecha">Cambios de estado</th><th className="derecha">Pedidos modificados</th></tr>
                  </thead>
                  <tbody>
                    {d.usuarios.map((u) => (
                      <tr key={u.usuario}>
                        <td>{u.usuario}</td>
                        <td className="derecha">{u.movimientos}</td>
                        <td className="derecha">{u.ediciones}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
