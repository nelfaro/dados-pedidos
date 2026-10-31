'use client';

import { useCallback, useEffect, useState } from 'react';
import { ETIQUETA, FLUJO } from '@/lib/estados';
import type { Item } from '@/lib/pedidos';

type Fila = {
  numero_pedido: string;
  fecha: string;
  cliente: string;
  contacto: string;
  items: Item[];
  total: number;
  estado: string;
  nota: string;
  gestionado_por: string;
  ultimo_movimiento: string;
};
type Reporte = { desde: string; hasta: string; estado: string; pedidos: Fila[] };

const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const dmy = (iso: string) => iso.split('-').reverse().join('/');

function isoHoy(offsetDias = 0) {
  return new Date(Date.now() - offsetDias * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export default function Reportes({ generadoPor }: { generadoPor: string }) {
  const [desde, setDesde] = useState(isoHoy(29));
  const [hasta, setHasta] = useState(isoHoy());
  const [estado, setEstado] = useState('todos');
  const [r, setR] = useState<Reporte | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`/api/reportes?desde=${desde}&hasta=${hasta}&estado=${estado}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo generar el reporte.');
      setR(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el reporte.');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const total = r?.pedidos.reduce((s, p) => s + p.total, 0) ?? 0;
  const porEstado = FLUJO.map((e) => {
    const l = r?.pedidos.filter((p) => p.estado === e) ?? [];
    return { e, n: l.length, monto: l.reduce((s, p) => s + p.total, 0) };
  });

  return (
    <div className="wrap">
      <div className="no-print">
        <h2 className="titulo">Reportes</h2>
        <div className="panel form-linea">
          <label className="campo">Desde<input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="campo">Hasta<input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
          <label className="campo">
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="todos">Todos</option>
              {FLUJO.map((e) => <option key={e} value={e}>{ETIQUETA[e]}</option>)}
            </select>
          </label>
          <button className="btn" onClick={() => window.print()} disabled={!r || r.pedidos.length === 0}>
            Imprimir / Guardar PDF
          </button>
        </div>
        <p className="fecha">En el diálogo de impresión elegí “Guardar como PDF” como destino.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      {cargando && !r && <p className="vacio">Cargando…</p>}

      {r && (
        <section className="reporte">
          <header className="reporte-cab">
            <h2>Reporte de pedidos · Dados</h2>
            <p>
              Período: {dmy(r.desde)} al {dmy(r.hasta)} · Estado: {r.estado === 'todos' ? 'Todos' : ETIQUETA[r.estado]}
              <br />
              Generado por {generadoPor} el {new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
            </p>
          </header>

          <div className="resumen">
            <div><span>Pedidos</span><b>{r.pedidos.length}</b></div>
            <div><span>Total</span><b>{peso.format(total)}</b></div>
            {porEstado.map((s) => (
              <div key={s.e}><span>{ETIQUETA[s.e]}</span><b>{s.n}</b><small>{peso.format(s.monto)}</small></div>
            ))}
          </div>

          {r.pedidos.length === 0 ? (
            <p className="vacio">No hay pedidos en este período.</p>
          ) : (
            <table className="tabla reporte-tabla">
              <thead>
                <tr>
                  <th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Productos</th>
                  <th className="derecha">Total</th><th>Estado</th><th>Gestionó</th>
                </tr>
              </thead>
              <tbody>
                {r.pedidos.map((p) => (
                  <tr key={p.numero_pedido}>
                    <td className="nowrap">{p.numero_pedido}</td>
                    <td className="nowrap">{p.fecha}</td>
                    <td>{p.cliente}<br /><small>{p.contacto}</small></td>
                    <td>
                      {p.items.map((it, i) => (
                        <div key={i}>{it.cantidad} × {it.nombre}</div>
                      ))}
                      {p.nota && <small>Modificado: {p.nota}</small>}
                    </td>
                    <td className="derecha nowrap">{peso.format(p.total)}</td>
                    <td>{ETIQUETA[p.estado] || p.estado}</td>
                    <td>{p.gestionado_por || '—'}{p.ultimo_movimiento && <><br /><small>{p.ultimo_movimiento}</small></>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>Total</td><td className="derecha nowrap">{peso.format(total)}</td><td colSpan={2} /></tr>
              </tfoot>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
