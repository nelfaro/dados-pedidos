export const TZ = 'America/Argentina/Buenos_Aires';

export type Item = {
  nombre: string;
  cantidad: number;
  precio_unit: number;
  total_linea: number;
  [extra: string]: unknown;
};

// La columna items puede venir como texto o como json segun como la cree el bot.
export function parseItems(raw: unknown): Item[] {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    return Array.isArray(v) ? (v as Item[]) : [];
  } catch {
    return [];
  }
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
