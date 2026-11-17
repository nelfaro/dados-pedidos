// Parte pura (sin base de datos): la usan tambien los componentes del navegador.
// Configuracion que se edita desde la pantalla /configuracion.
// Se guarda como un unico JSON (dados_config, clave 'general'). n8n lee la misma fila.

export type Tramo = [string, string];
export type DiaHorario = { activo: boolean; tramos: Tramo[] };

export type Config = {
  derivacion: {
    telegram_chat_id: string;
    vendedores_wa: string[];
    wa_from: string;
    vencimiento_horas: number;
    mensaje_abierto: string;
    mensaje_cerrado: string;
  };
  horario: { activo: boolean; dias: Record<string, DiaHorario> };
  busqueda: { max_preguntas: number };
};

// Orden de la semana para mostrar. La clave es el numero de dia (0 = domingo), igual que usa n8n.
export const DIAS: { n: string; texto: string }[] = [
  { n: '1', texto: 'Lunes' },
  { n: '2', texto: 'Martes' },
  { n: '3', texto: 'Miércoles' },
  { n: '4', texto: 'Jueves' },
  { n: '5', texto: 'Viernes' },
  { n: '6', texto: 'Sábado' },
  { n: '0', texto: 'Domingo' },
];

const MENSAJE_ABIERTO =
  'Ya le avisé a un vendedor del local, te va a escribir en breve. Mientras tanto no voy a poder ayudarte con más consultas por este chat.';
const MENSAJE_CERRADO = 'Ya le avisé a un vendedor del local. Ahora el local está cerrado: te va a escribir cuando abra.';

function horarioBase(): Record<string, DiaHorario> {
  const dias: Record<string, DiaHorario> = {};
  for (const d of DIAS) {
    const habil = d.n !== '0' && d.n !== '6';
    dias[d.n] = { activo: habil, tramos: habil ? [['09:00', '13:00'], ['16:00', '20:00']] : [] };
  }
  return dias;
}

export function configPorDefecto(): Config {
  return {
    derivacion: {
      telegram_chat_id: '',
      vendedores_wa: [],
      wa_from: '',
      vencimiento_horas: 2,
      mensaje_abierto: MENSAJE_ABIERTO,
      mensaje_cerrado: MENSAJE_CERRADO,
    },
    // Mientras "activo" sea false, el local se considera siempre abierto.
    horario: { activo: false, dias: horarioBase() },
    busqueda: { max_preguntas: 3 },
  };
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function telefono(v: unknown): string | null {
  const limpio = String(v ?? '').replace(/[\s().-]/g, '');
  const conMas = limpio.startsWith('+') ? limpio : '+' + limpio;
  return /^\+\d{8,15}$/.test(conMas) ? conMas : null;
}

// Valida y completa lo que llega del formulario. Devuelve el error en castellano si algo no cierra.
export function normalizar(raw: unknown): { config: Config } | { error: string } {
  const base = configPorDefecto();
  const r = (raw ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = (r.derivacion ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  const chat = String(d.telegram_chat_id ?? '').trim();
  if (chat && !/^(-?\d{5,20}|@[A-Za-z0-9_]{4,})$/.test(chat)) {
    return { error: 'El grupo de Telegram debe ser un número (por ejemplo -1001234567890) o un @canal.' };
  }

  const lista: string[] = Array.isArray(d.vendedores_wa)
    ? d.vendedores_wa
    : String(d.vendedores_wa ?? '').split(/[\n,;]+/);
  const vendedores: string[] = [];
  for (const item of lista) {
    if (!String(item).trim()) continue;
    const t = telefono(item);
    if (!t) return { error: `El número "${String(item).trim()}" no es válido. Usá formato internacional, ej: +5493794000000.` };
    if (!vendedores.includes(t)) vendedores.push(t);
  }
  if (vendedores.length > 10) return { error: 'Máximo 10 números de vendedores.' };

  let waFrom = '';
  if (String(d.wa_from ?? '').trim()) {
    const t = telefono(d.wa_from);
    if (!t) return { error: 'El número del negocio no es válido. Usá formato internacional, ej: +5493794000000.' };
    waFrom = t;
  }

  const venc = Number(d.vencimiento_horas);
  if (!Number.isInteger(venc) || venc < 1 || venc > 24) {
    return { error: 'Las horas hasta que el bot retoma deben ser un número entero entre 1 y 24.' };
  }

  const mAbierto = String(d.mensaje_abierto ?? '').trim() || base.derivacion.mensaje_abierto;
  const mCerrado = String(d.mensaje_cerrado ?? '').trim() || base.derivacion.mensaje_cerrado;
  if (mAbierto.length > 400 || mCerrado.length > 400) return { error: 'Los mensajes al cliente admiten hasta 400 caracteres.' };

  const h = (r.horario ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const dias: Record<string, DiaHorario> = {};
  let algunDia = false;
  for (const dia of DIAS) {
    const src = (h.dias ?? {})[dia.n] ?? {};
    const tramos: Tramo[] = [];
    if (src.activo) {
      for (const t of (Array.isArray(src.tramos) ? src.tramos : []).slice(0, 2)) {
        const ini = String(t?.[0] ?? '');
        const fin = String(t?.[1] ?? '');
        if (!ini && !fin) continue;
        if (!HORA.test(ini) || !HORA.test(fin)) return { error: `${dia.texto}: horario inválido.` };
        if (ini >= fin) return { error: `${dia.texto}: la hora de cierre debe ser posterior a la de apertura.` };
        tramos.push([ini, fin]);
      }
      if (!tramos.length) return { error: `${dia.texto}: está marcado como abierto pero no tiene horario.` };
      if (tramos.length === 2 && tramos[0][1] > tramos[1][0]) {
        return { error: `${dia.texto}: los dos tramos se superponen.` };
      }
      algunDia = true;
    }
    dias[dia.n] = { activo: !!src.activo, tramos };
  }
  const activo = !!h.activo;
  if (activo && !algunDia) return { error: 'Activaste el horario pero no marcaste ningún día abierto.' };

  const max = Number((r.busqueda ?? {}).max_preguntas);
  if (!Number.isInteger(max) || max < 0 || max > 5) {
    return { error: 'El máximo de preguntas de afinado debe ser un número entero entre 0 y 5.' };
  }

  return {
    config: {
      derivacion: {
        telegram_chat_id: chat,
        vendedores_wa: vendedores,
        wa_from: waFrom,
        vencimiento_horas: venc,
        mensaje_abierto: mAbierto,
        mensaje_cerrado: mCerrado,
      },
      horario: { activo, dias },
      busqueda: { max_preguntas: max },
    },
  };
}
