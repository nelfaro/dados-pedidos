import { NextResponse } from 'next/server';
import { asegurarEsquema, pool } from './db';
import { sesionActual, type Sesion } from './auth';

type Resultado = { sesion: Sesion } | { error: NextResponse };

// Verifica contra la base (no solo contra la cookie) que el usuario siga activo
// y con el rol vigente. Asi un cambio de rol o una baja aplica de inmediato.
export async function autorizar(soloAdmin = false): Promise<Resultado> {
  const s = await sesionActual();
  if (!s) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };

  await asegurarEsquema();
  const { rows } = await pool.query('SELECT rol, activo FROM dados_usuarios WHERE usuario = $1', [s.usuario]);
  const u = rows[0];
  if (!u || !u.activo) {
    return { error: NextResponse.json({ error: 'Usuario inactivo' }, { status: 401 }) };
  }
  const rol = u.rol === 'admin' ? 'admin' : 'vendedor';
  if (soloAdmin && rol !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo para administradores' }, { status: 403 }) };
  }
  return { sesion: { ...s, rol } };
}
