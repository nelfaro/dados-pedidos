// Flujo que gestiona el personal. 'modificando' y 'cancelado' los maneja el bot.
export const FLUJO = ['confirmado', 'pagado', 'listo', 'entregado'] as const;
export type EstadoFlujo = (typeof FLUJO)[number];

export const ETIQUETA: Record<string, string> = {
  confirmado: 'Por cobrar',
  pagado: 'Pagado',
  listo: 'Listo',
  entregado: 'Entregado',
  modificando: 'Cliente editando',
  cancelado: 'Cancelado',
};

export function esEstadoFlujo(e: unknown): e is EstadoFlujo {
  return typeof e === 'string' && (FLUJO as readonly string[]).includes(e);
}

// Se permite avanzar un paso o retroceder uno (para corregir un error de carga).
export function transicionValida(desde: string, hacia: string): boolean {
  if (!esEstadoFlujo(desde) || !esEstadoFlujo(hacia)) return false;
  return Math.abs(FLUJO.indexOf(hacia) - FLUJO.indexOf(desde)) === 1;
}
