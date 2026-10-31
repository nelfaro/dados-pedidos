import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await autorizar(true);
  if ('error' in a) return a.error;
  const { rows } = await pool.query(
    `SELECT id, usuario, nombre, rol, activo,
            to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM/YYYY') AS alta
     FROM dados_usuarios ORDER BY activo DESC, rol, usuario`
  );
  return NextResponse.json({ usuarios: rows });
}

export async function POST(req: NextRequest) {
  const a = await autorizar(true);
  if ('error' in a) return a.error;

  const body = await req.json().catch(() => ({}));
  const usuario = String(body.usuario || '').trim().toLowerCase();
  const nombre = String(body.nombre || '').trim().slice(0, 80);
  const password = String(body.password || '');
  const rol = body.rol === 'admin' ? 'admin' : body.rol === 'vendedor' ? 'vendedor' : '';

  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
    return NextResponse.json({ error: 'Usuario: 3 a 30 letras minúsculas, números, punto, guion o guion bajo' }, { status: 400 });
  }
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }
  if (!rol) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });

  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO dados_usuarios (usuario, nombre, password_hash, rol) VALUES ($1,$2,$3,$4)',
      [usuario, nombre, hash, rol]
    );
  } catch (e: unknown) {
    if ((e as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ese usuario ya existe' }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
