import { asegurarEsquema, pool } from './db';
import { configPorDefecto, normalizar, type Config } from './config-base';

export * from './config-base';

// Lectura y escritura en la base (solo servidor).
export async function leerConfig(): Promise<Config> {
  await asegurarEsquema();
  const { rows } = await pool.query("SELECT valor FROM dados_config WHERE clave = 'general'");
  if (!rows[0]) return configPorDefecto();
  // Lo guardado puede ser de una version anterior: se completa con los valores por defecto.
  const r = normalizar(mezclar(configPorDefecto(), rows[0].valor));
  return 'config' in r ? r.config : configPorDefecto();
}

export async function guardarConfig(c: Config, usuario: string): Promise<void> {
  await asegurarEsquema();
  await pool.query(
    `INSERT INTO dados_config (clave, valor, updated_by) VALUES ('general', $1::jsonb, $2)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify(c), usuario]
  );
}

function mezclar<T>(base: T, extra: unknown): T {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
    const b = out[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? mezclar(b, v) : v;
  }
  return out as T;
}
