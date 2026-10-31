'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ESTADO_EDITABLE, ETIQUETA, FLUJO } from '@/lib/estados';
import type { Item } from '@/lib/pedidos';
import EditarPedido from './EditarPedido';

type Pedido = {
  numero_pedido: string;
  canal: string;
  contacto: string;
  cliente: string;
  items: Item[];
  total: number;
  cantidad_items: number;
  estado: string;
  nota: string;
  fecha: string;
  actualizado: string;
};

const SIGUIENTE: Record<string, { estado: string; texto: string }> = {
  confirmado: { estado: 'pagado', texto: 'Marcar pagado' },
  pagado: { estado: 'listo', texto: 'Marcar listo' },
  listo: { estado: 'entregado', texto: 'Marcar entregado' },
};
const ANTERIOR: Record<string, string> = { pagado: 'confirmado', listo: 'pagado', entregado: 'listo' };
const LINEAS_VISIBLES = 4;

const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

function enlaceContacto(p: Pedido) {
  if (p.canal !== 'whatsapp') return null;
  const digitos = p.contacto.replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}` : null;
}

export default function Tablero() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Pedido | null>(null);

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

  const columnas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const visibles = pedidos.filter(
      (p) =>
        !t ||
        p.numero_pedido.toLowerCase().includes(t) ||
        p.cliente.toLowerCase().includes(t) ||
        p.contacto.toLowerCase().includes(t)
    );
    return FLUJO.map((estado) => {
      // "Cliente editando" se muestra junto a Por cobrar: todavia no esta cobrado.
      const lista = visibles.filter((p) =>
        estado === 'confirmado' ? p.estado === 'confirmado' || p.estado === 'modificando' : p.estado === estado
      );
      return { estado, lista, monto: lista.reduce((s, p) => s + p.total, 0) };
    });
  }, [pedidos, q]);

  return (
    <div className="wrap ancho">
      <div className="barra">
        <input
          className="buscar"
          type="search"
          placeholder="Buscar por número, cliente o teléfono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {error && <span className="error" role="alert">{error}</span>}
      </div>

      {cargando ? (
        <p className="vacio">Cargando…</p>
      ) : (
        <div className="board">
          {columnas.map((c) => (
            <section className="col" key={c.estado} style={{ ['--col' as string]: `var(--c-${c.estado})` }}>
              <header className="col-cab">
                <h2>{ETIQUETA[c.estado]}</h2>
                <span className="n">{c.lista.length}</span>
                <span className="monto">{peso.format(c.monto)}</span>
              </header>
              <div className="lista">
                {c.lista.length === 0 && <p className="vacio chico">Sin pedidos</p>}
                {c.lista.map((p) => {
                  const sig = SIGUIENTE[p.estado];
                  const ant = ANTERIOR[p.estado];
                  const link = enlaceContacto(p);
                  const bloqueado = ocupado === p.numero_pedido;
                  const resto = p.items.length - LINEAS_VISIBLES;
                  return (
                    <article className="card" key={p.numero_pedido}>
                      <div className="cab">
                        <span className="num">{p.numero_pedido}</span>
                        <span className="fecha">{p.fecha}</span>
                      </div>
                      <div className="cli">
                        <div>
                          <div>{p.cliente}</div>
                          <div className="fecha">{p.canal === 'telegram' ? 'Telegram' : p.contacto}</div>
                        </div>
                        {link && <a href={link} target="_blank" rel="noreferrer">WhatsApp</a>}
                      </div>
                      <ul className="items">
                        {p.items.slice(0, LINEAS_VISIBLES).map((it, i) => (
                          <li key={i}>
                            <span>{it.nombre}</span>
                            <span className="q">{it.cantidad} × {peso.format(it.precio_unit)}</span>
                          </li>
                        ))}
                        {resto > 0 && <li className="mas">+ {resto} producto{resto > 1 ? 's' : ''} más</li>}
                      </ul>
                      {p.nota && <p className="nota">Modificado: {p.nota}</p>}
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
                          {p.estado === ESTADO_EDITABLE && (
                            <button className="btn sec" disabled={bloqueado} onClick={() => setEditando(p)}>
                              Editar
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
            </section>
          ))}
        </div>
      )}

      {editando && (
        <EditarPedido
          numero={editando.numero_pedido}
          cliente={editando.cliente}
          items={editando.items}
          notaActual={editando.nota}
          onCerrar={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  );
}
