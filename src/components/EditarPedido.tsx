'use client';

import { useState } from 'react';
import type { Item } from '@/lib/pedidos';
import Icono from './Icono';

type Fila = { key: number; base: Item | null; nombre: string; cantidad: string; precio: string };

const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

export default function EditarPedido({
  numero,
  cliente,
  items,
  notaActual,
  onCerrar,
  onGuardado,
}: {
  numero: string;
  cliente: string;
  items: Item[];
  notaActual: string;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [filas, setFilas] = useState<Fila[]>(
    items.map((it, i) => ({
      key: i,
      base: it,
      nombre: it.nombre,
      cantidad: String(it.cantidad),
      precio: String(it.precio_unit),
    }))
  );
  const [motivo, setMotivo] = useState(notaActual);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const total = filas.reduce((s, f) => s + (Number(f.cantidad) || 0) * (Number(f.precio) || 0), 0);

  function cambiar(key: number, campo: 'nombre' | 'cantidad' | 'precio', valor: string) {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)));
  }
  function agregar() {
    setFilas((fs) => [...fs, { key: Math.max(-1, ...fs.map((f) => f.key)) + 1, base: null, nombre: '', cantidad: '1', precio: '' }]);
  }
  function quitar(key: number) {
    setFilas((fs) => fs.filter((f) => f.key !== key));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (filas.length === 0) return setError('El pedido tiene que tener al menos un producto.');
    for (const f of filas) {
      if (!f.nombre.trim()) return setError('Todos los productos necesitan nombre.');
      const c = Number(f.cantidad);
      if (!Number.isInteger(c) || c < 1) return setError('La cantidad debe ser un número entero de 1 en adelante.');
      const p = Number(f.precio);
      if (f.precio === '' || !Number.isFinite(p) || p < 0) return setError('Revisá los precios.');
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/pedidos/${encodeURIComponent(numero)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo,
          items: filas.map((f) => ({
            ...(f.base ?? {}),
            nombre: f.nombre,
            cantidad: Number(f.cantidad),
            precio_unit: Number(f.precio),
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'No se pudo guardar.');
        // Si el pedido cambio de estado mientras editabas, se refresca el tablero.
        if (res.status === 409) onGuardado();
        return;
      }
      onGuardado();
      onCerrar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="modal" onSubmit={guardar} role="dialog" aria-modal="true" aria-label={`Modificar ${numero}`}>
        <h2>Modificar {numero}</h2>
        <p className="fecha">{cliente} · solo se puede editar antes del cobro</p>

        <div className="editor">
          <div className="editor-cab">
            <span>Producto</span>
            <span>Cant.</span>
            <span>Precio unit.</span>
            <span />
          </div>
          {filas.map((f) => (
            <div className="editor-fila" key={f.key}>
              <input
                aria-label="Producto"
                value={f.nombre}
                onChange={(e) => cambiar(f.key, 'nombre', e.target.value)}
                placeholder="Nombre del producto"
              />
              <input
                aria-label="Cantidad"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={f.cantidad}
                onChange={(e) => cambiar(f.key, 'cantidad', e.target.value)}
              />
              <input
                aria-label="Precio unitario"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={f.precio}
                onChange={(e) => cambiar(f.key, 'precio', e.target.value)}
              />
              <button type="button" className="quitar" onClick={() => quitar(f.key)} aria-label="Quitar producto">
                <Icono n="cerrar" size={15} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={agregar} style={{ alignSelf: 'flex-start' }}>
            <Icono n="mas" size={14} /> Agregar producto
          </button>
        </div>

        <label className="campo">
          Motivo del cambio (el agente se lo puede informar al cliente)
          <textarea
            value={motivo}
            maxLength={300}
            rows={2}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: sin stock del talle 38, se cambió por el 39"
          />
        </label>

        <div className="total">
          <span>Nuevo total</span>
          <span className="mono">{peso.format(total)}</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="acciones">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  );
}
