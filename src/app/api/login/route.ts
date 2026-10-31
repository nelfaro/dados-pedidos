import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { asegurarEsquema, pool } from '@/lib/db';
import { COOKIE, firmarSesion, opcionesCookie } from '@/lib/auth';

// Freno simple a fuerza bruta: 8 intentos fallidos por IP cada 10 minutos.
const intentos = new Map<string, { n: number; hasta: number }>();
const VENTANA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 8;
// Se compara igual aunque el usuario no exista, para no revelar si existe por tiempo de respuesta.
const HASH_FALSO = bcrypt.hashSync('sin-usuario', 10);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const ahora = Date.now();
  const reg = intentos.get(ip);
  if (reg && reg.hasta > ahora && reg.n >= MAX_INTENTOS) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá en unos minutos.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const usuario = String(body.usuario || '').trim().toLowerCase();
  const password = String(body.password || '');

  await asegurarEsquema();
  const { rows } = await pool.query(
    'SELECT usuario, nombre, password_hash FROM dados_usuarios WHERE usuario = $1 AND activo',
    [usuario]
  );
  const u = rows[0];
  const ok = await bcrypt.compare(password, u?.password_hash ?? HASH_FALSO);

  if (!u || !ok) {
    const vigente = reg && reg.hasta > ahora ? reg : { n: 0, hasta: ahora + VENTANA_MS };
    vigente.n += 1;
    intentos.set(ip, vigente);
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  intentos.delete(ip);
  const token = await firmarSesion({ usuario: u.usuario, nombre: u.nombre });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, opcionesCookie);
  return res;
}
