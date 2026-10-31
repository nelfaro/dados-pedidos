import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const COOKIE = 'dados_session';
const DURACION_SEG = 60 * 60 * 12;

export type Sesion = { usuario: string; nombre: string };

function clave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');
  return new TextEncoder().encode(s);
}

export async function firmarSesion(s: Sesion): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEG}s`)
    .sign(clave());
}

export async function verificarToken(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    return { usuario: String(payload.usuario), nombre: String(payload.nombre) };
  } catch {
    return null;
  }
}

export async function sesionActual(): Promise<Sesion | null> {
  const jar = await cookies();
  return verificarToken(jar.get(COOKIE)?.value);
}

export const opcionesCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DURACION_SEG,
};
