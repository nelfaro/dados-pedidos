'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ETIQUETA, FLUJO } from '@/lib/estados';

type Item = { nombre: string; cantidad: number; precio_unit: number; total_linea: number };
type Pedido = {
  numero_pedido: string;
  canal: string;
  contacto: string;
  cliente: string;
  items: Item[];
  total: number;
  cantidad_items: number;
  estado: string;
  fecha: string;
  actualizado: string;
};

const SIGUIENTE: Record<string, { estado: string; texto: string }> = {
  confirmado: { estado: 'pagado', texto: 'Marcar pagado' },
  pagado: { estado: 'listo', texto: 'Marcar listo' },
  listo: { estado: 'entregado', texto: 'Marcar entregado' },
};
const ANTERIOR: Record<string, string> = { pagado: 'confirmado', listo: 'pagado', entregado: 'listo' };

const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

function enlaceContacto(p: Pedido) {
  if (p.canal !== 'whatsapp') return null;
  const digitos = p.contacto.replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}` : null;
}

export default function Tablero({ nombre }: { nombre: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('confirmado');
  const [q, setQ] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/pedidos', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error();
      const j = await res.json();
      setPedidos(j.pedidos);
      setError('');
    } catch {
      setError('No se pudo actualizar la lista.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  async function cambiar(p: Pedido, estado: string) {
    setOcupado(p.numero_pedido);
    setError('');
    try {
      const res = await fetch(`/api/pedidos/${encodeURIComponent(p.numero_pedido)}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'No se pudo cambiar el estado.');
      }
    } finally {
      setOcupado(null);
      cargar();
    }
  }

  async function salir() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const conteo = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of pedidos) c[p.estado] = (c[p.estado] || 0) + 1;
    return c;
  }, [pedidos]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pedidos.filter((p) => {
      const porTab =
        tab === 'todos' ? true : tab === 'confirmado' ? p.estado === 'confirmado' || p.estado === 'modificando' : p.estado === tab;
      if (!porTab) return false;
      if (!t) return true;
      return (
        p.numero_pedido.toLowerCase().includes(t) ||
        p.cliente.toLowerCase().includes(t) ||
        p.contacto.toLowerCase().includes(t)
      );
    });
  }, [pedidos, tab, q]);

  const tabs = [...FLUJO, 'todos'] as string[];

  return (
    <>
      <header className="top">
        <h1>Pedidos · Dados</h1>
        <span className="quien">{nombre}</span>
        <button className="link" onClick={salir}>Salir</button>
      </header>

      <div className="wrap">
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t} className="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'todos' ? 'Todos' : ETIQUETA[t]}
              <span className="n">
                {t === 'todos'
                  ? pedidos.length
                  : (conteo[t] || 0) + (t === 'confirmado' ? conteo['modificando'] || 0 : 0)}
              </span>
            </button>
          ))}
        </div>

        <input
          className="buscar"
          type="search"
          placeholder="Buscar por número, cliente o teléfono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {error && <p className="error" role="alert">{error}</p>}

        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="vacio">No hay pedidos en esta vista.</p>
        ) : (
          <div className="grid">
            {visibles.map((p) => {
              const sig = SIGUIENTE[p.estado];
              const ant = ANTERIOR[p.estado];
              const link = enlaceContacto(p);
              const bloqueado = ocupado === p.numero_pedido;
              return (
                <article className="card" key={p.numero_pedido}>
                  <div className="cab">
                    <span className="num">{p.numero_pedido}</span>
                    <span className={`badge b-${p.estado}`}>{ETIQUETA[p.estado] || p.estado}</span>
                  </div>
                  <div className="cli">
                    <div>
                      <div>{p.cliente}</div>
                      <div className="fecha">{p.fecha} · {p.canal === 'telegram' ? 'Telegram' : p.contacto}</div>
                    </div>
                    {link && <a href={link} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
                  </div>
                  <ul className="items">
                    {p.items.map((it, i) => (
                      <li key={i}>
                        <span>{it.nombre}</span>
                        <span className="q">{it.cantidad} × {peso.format(it.precio_unit)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="total">
                    <span>{p.cantidad_items} productos</span>
                    <span>{peso.format(p.total)}</span>
                  </div>
                  {p.estado === 'modificando' ? (
                    <p className="aviso">El cliente está editando este pedido. Esperá a que lo confirme.</p>
                  ) : (
                    <div className="acciones">
                      {ant && (
                        <button
                          className="btn sec"
                          disabled={bloqueado}
                          onClick={() => {
                            if (confirm(`¿Volver ${p.numero_pedido} a "${ETIQUETA[ant]}"?`)) cambiar(p, ant);
                          }}
                        >
                          Deshacer
                        </button>
                      )}
                      {sig && (
                        <button className="btn" disabled={bloqueado} onClick={() => cambiar(p, sig.estado)}>
                          {sig.texto}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
