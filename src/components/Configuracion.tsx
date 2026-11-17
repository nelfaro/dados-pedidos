'use client';

import { useEffect, useState } from 'react';
import { DIAS, type Config } from '@/lib/config-base';

type Form = {
  telegram_chat_id: string;
  vendedores_wa: string; // uno por linea
  wa_from: string;
  vencimiento_horas: string;
  mensaje_abierto: string;
  mensaje_cerrado: string;
  horario_activo: boolean;
  dias: Record<string, { activo: boolean; t: [string, string, string, string] }>;
  max_preguntas: string;
};

function aForm(c: Config): Form {
  const dias: Form['dias'] = {};
  for (const d of DIAS) {
    const x = c.horario.dias[d.n];
    dias[d.n] = {
      activo: x.activo,
      t: [x.tramos[0]?.[0] ?? '', x.tramos[0]?.[1] ?? '', x.tramos[1]?.[0] ?? '', x.tramos[1]?.[1] ?? ''],
    };
  }
  return {
    telegram_chat_id: c.derivacion.telegram_chat_id,
    vendedores_wa: c.derivacion.vendedores_wa.join('\n'),
    wa_from: c.derivacion.wa_from,
    vencimiento_horas: String(c.derivacion.vencimiento_horas),
    mensaje_abierto: c.derivacion.mensaje_abierto,
    mensaje_cerrado: c.derivacion.mensaje_cerrado,
    horario_activo: c.horario.activo,
    dias,
    max_preguntas: String(c.busqueda.max_preguntas),
  };
}

function aConfig(f: Form): unknown {
  const dias: Record<string, unknown> = {};
  for (const d of DIAS) {
    const x = f.dias[d.n];
    const tramos = [];
    if (x.t[0] || x.t[1]) tramos.push([x.t[0], x.t[1]]);
    if (x.t[2] || x.t[3]) tramos.push([x.t[2], x.t[3]]);
    dias[d.n] = { activo: x.activo, tramos };
  }
  return {
    derivacion: {
      telegram_chat_id: f.telegram_chat_id,
      vendedores_wa: f.vendedores_wa,
      wa_from: f.wa_from,
      vencimiento_horas: Number(f.vencimiento_horas),
      mensaje_abierto: f.mensaje_abierto,
      mensaje_cerrado: f.mensaje_cerrado,
    },
    horario: { activo: f.horario_activo, dias },
    busqueda: { max_preguntas: Number(f.max_preguntas) },
  };
}

export default function Configuracion() {
  const [f, setF] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/configuracion', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/';
        return;
      }
      if (res.ok) setF(aForm((await res.json()).config));
      else setError('No se pudo cargar la configuración.');
    })();
  }, []);

  if (!f) return error ? <p className="error" role="alert">{error}</p> : <p className="fecha">Cargando…</p>;

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setAviso('');
    setF((prev) => (prev ? { ...prev, [k]: v } : prev));
  }
  function setDia(n: string, cambios: Partial<Form['dias'][string]>) {
    setAviso('');
    setF((prev) => (prev ? { ...prev, dias: { ...prev.dias, [n]: { ...prev.dias[n], ...cambios } } } : prev));
  }
  function setHora(n: string, i: number, v: string) {
    const t = [...f!.dias[n].t] as Form['dias'][string]['t'];
    t[i] = v;
    setDia(n, { t });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    setGuardando(true);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aConfig(f!)),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setError(j.error || 'No se pudo guardar.');
      setF(aForm(j.config));
      setAviso('Configuración guardada. El agente la toma en el próximo mensaje.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <p className="fecha">
        Todo lo que cambia el comportamiento del agente se configura acá. Los usuarios y sus roles están en <b>Usuarios</b>.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {aviso && <p className="ok" role="status">{aviso}</p>}

      <section className="panel">
        <h3>Avisos al vendedor</h3>
        <p className="sub-panel">Cuando el agente no puede resolver algo, avisa por estos canales.</p>
        <div className="grilla-2">
          <label className="campo">
            Grupo o chat de Telegram
            <input
              value={f.telegram_chat_id}
              onChange={(e) => set('telegram_chat_id', e.target.value)}
              placeholder="-1001234567890"
              autoComplete="off"
              inputMode="text"
            />
            <small>Número del grupo (suele empezar con -100). Hay que agregar el bot al grupo.</small>
          </label>
          <label className="campo">
            Número del negocio (remitente)
            <input
              value={f.wa_from}
              onChange={(e) => set('wa_from', e.target.value)}
              placeholder="+5493794026722"
              autoComplete="off"
              inputMode="tel"
            />
            <small>Desde el que se envían los avisos por WhatsApp. Vacío = el que ya usa el agente.</small>
          </label>
        </div>
        <label className="campo" style={{ marginTop: 12 }}>
          Números de WhatsApp de los vendedores
          <textarea
            rows={3}
            value={f.vendedores_wa}
            onChange={(e) => set('vendedores_wa', e.target.value)}
            placeholder={'+5493794000001\n+5493794000002'}
          />
          <small>Uno por línea, en formato internacional. Máximo 10. Si lo dejás vacío no se avisa por WhatsApp.</small>
        </label>
      </section>

      <section className="panel">
        <h3>Horario del local</h3>
        <p className="sub-panel">
          Fuera de horario el agente igual avisa al vendedor, pero le dice al cliente que lo atienden cuando abra.
        </p>
        <label className="check">
          <input type="checkbox" checked={f.horario_activo} onChange={(e) => set('horario_activo', e.target.checked)} />
          Usar horario (si no, se considera siempre abierto)
        </label>
        <div className="tabla-wrap" style={{ opacity: f.horario_activo ? 1 : 0.5 }}>
          <table className="tabla">
            <thead>
              <tr><th>Día</th><th>Abre</th><th>Mañana</th><th>Tarde</th></tr>
            </thead>
            <tbody>
              {DIAS.map((d) => {
                const x = f.dias[d.n];
                return (
                  <tr key={d.n}>
                    <td>{d.texto}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${d.texto} abierto`}
                        checked={x.activo}
                        disabled={!f.horario_activo}
                        onChange={(e) => setDia(d.n, { activo: e.target.checked })}
                      />
                    </td>
                    {[0, 2].map((i) => (
                      <td key={i}>
                        <span className="horas">
                          <input type="time" aria-label={`${d.texto} desde`} value={x.t[i]} disabled={!f.horario_activo || !x.activo} onChange={(e) => setHora(d.n, i, e.target.value)} />
                          <span>a</span>
                          <input type="time" aria-label={`${d.texto} hasta`} value={x.t[i + 1]} disabled={!f.horario_activo || !x.activo} onChange={(e) => setHora(d.n, i + 1, e.target.value)} />
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="aviso">Hora de Argentina. Dejá el segundo tramo vacío si el local abre de corrido.</p>
      </section>

      <section className="panel">
        <h3>Atención humana</h3>
        <label className="campo" style={{ maxWidth: 260 }}>
          Horas hasta que el bot retoma solo
          <input
            type="number"
            min={1}
            max={24}
            value={f.vencimiento_horas}
            onChange={(e) => set('vencimiento_horas', e.target.value)}
          />
          <small>Si nadie marca la atención como resuelta, el bot vuelve a contestar pasado este tiempo.</small>
        </label>
        <div className="grilla-2" style={{ marginTop: 12 }}>
          <label className="campo">
            Mensaje al cliente con el local abierto
            <textarea rows={3} maxLength={400} value={f.mensaje_abierto} onChange={(e) => set('mensaje_abierto', e.target.value)} />
          </label>
          <label className="campo">
            Mensaje al cliente con el local cerrado
            <textarea rows={3} maxLength={400} value={f.mensaje_cerrado} onChange={(e) => set('mensaje_cerrado', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h3>Búsqueda de productos</h3>
        <label className="campo" style={{ maxWidth: 260 }}>
          Máximo de preguntas para afinar
          <input
            type="number"
            min={0}
            max={5}
            value={f.max_preguntas}
            onChange={(e) => set('max_preguntas', e.target.value)}
          />
          <small>Cuántas veces puede preguntarle al cliente antes de mostrar los 10 primeros productos. 0 = nunca pregunta.</small>
        </label>
      </section>

      <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar configuración'}</button>
    </form>
  );
}
