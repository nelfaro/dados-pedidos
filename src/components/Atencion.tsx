'use client';

import { useCallback, useEffect, useState } from 'react';
import Icono from './Icono';

type Pendiente = {
  id: number;
  session_id: string;
  canal: string;
  cliente: string;
  motivo: string;
  resumen: string;
  detalle: string;
  hora: string;
  espera_seg: number;
};

function espera(seg: number) {
  const min = Math.max(0, Math.round(seg / 60));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h ${min % 60} min`;
}

function enlace(p: Pendiente) {
  if (p.canal === 'telegram') return null;
  const digitos = p.session_id.replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}` : null;
}

// Clientes que pidieron hablar con una persona. Mientras figuren acá, el bot no les contesta.
export default function Atencion() {
  const [lista, setLista] = useState<Pendiente[]>([]);
  const [vence, setVence] = useState(2);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/atencion', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setLista(j.pendientes);
      setVence(j.vencimiento_horas);
    } catch {
      /* se reintenta en el proximo ciclo */
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  async function resolver(p: Pendiente) {
    setOcupado(p.id);
    setError('');
    try {
      const res = await fetch(`/api/atencion/${p.id}/resolver`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'No se pudo marcar como resuelta.');
    } finally {
      setOcupado(null);
      cargar();
    }
  }

  if (!lista.length) return null;

  return (
    <section className="panel atencion" aria-label="Clientes esperando a un vendedor">
      <h3>
        <Icono n="chat" size={16} /> Esperando a un vendedor <span className="tag tag-err">{lista.length}</span>
      </h3>
      <p className="sub-panel">
        El bot no les responde hasta que marques la atención como resuelta (o pasen {vence} h).
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="atencion-lista">
        {lista.map((p) => {
          const wa = enlace(p);
          return (
            <li key={p.id} className="atencion-item">
              <div className="atencion-cab">
                <b>{p.cliente || 'Cliente'}</b>
                <span className="fecha">
                  {p.hora} · {espera(p.espera_seg)}
                </span>
                {wa ? (
                  <a className="link" href={wa} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
                ) : (
                  <span className="fecha">Telegram · {p.session_id.replace(/^tg:/, '')}</span>
                )}
                <button className="btn btn-primary btn-chico" disabled={ocupado === p.id} onClick={() => resolver(p)}>
                  {ocupado === p.id ? 'Guardando…' : 'Resuelto'}
                </button>
              </div>
              <div><b>Motivo:</b> {p.motivo}</div>
              {p.resumen && <div><b>Qué pasó:</b> {p.resumen}</div>}
              {p.detalle && (
                <details className="tabla-det">
                  <summary>Ver pedido y búsqueda del cliente</summary>
                  <pre className="atencion-detalle">{p.detalle}</pre>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
