import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';

// Cierra la derivacion: desde este momento el bot vuelve a atender al cliente.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await autorizar();
  if ('error' in a) return a.error;

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 });

  const { rowCount } = await pool.query(
    `UPDATE atencion_humana SET estado = 'resuelto', resuelto_at = now(), resuelto_por = $2
     WHERE id = $1 AND estado = 'pendiente'`,
    [id, a.sesion.usuario]
  );
  if (!rowCount) {
    return NextResponse.json({ error: 'Ya estaba resuelta o venció.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
