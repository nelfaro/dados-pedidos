import { NextRequest, NextResponse } from 'next/server';
import { autorizar } from '@/lib/guard';
import { guardarConfig, leerConfig, normalizar } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await autorizar(true);
  if ('error' in a) return a.error;
  return NextResponse.json({ config: await leerConfig() });
}

export async function PUT(req: NextRequest) {
  const a = await autorizar(true);
  if ('error' in a) return a.error;

  const body = await req.json().catch(() => null);
  const r = normalizar(body);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });

  try {
    await guardarConfig(r.config, a.sesion.usuario);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'No se pudo guardar la configuración.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: r.config });
}
