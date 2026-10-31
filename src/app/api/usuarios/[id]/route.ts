import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { autorizar } from '@/lib/guard';

// Cambia rol, estado (activo/inactivo), nombre o contraseña de un usuario.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await autorizar(true);
  if ('error' in a) return a.error;

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    // Se bloquean los admins activos para que dos cambios simultaneos no dejen el sistema sin ninguno.
    const { rows: admins } = await cli.query(
      "SELECT id FROM dados_usuarios WHERE rol = 'admin' AND activo FOR UPDATE"
    );
    const { rows } = await cli.query('SELECT id, rol, activo FROM dados_usuarios WHERE id = $1', [id]);
    const u = rows[0];
    if (!u) {
      await cli.query('ROLLBACK');
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const rol = body.rol === undefined ? u.rol : body.rol === 'admin' ? 'admin' : body.rol === 'vendedor' ? 'vendedor' : null;
    const activo = body.activo === undefined ? u.activo : Boolean(body.activo);
    if (rol === null) {
      await cli.query('ROLLBACK');
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const eraAdminActivo = u.rol === 'admin' && u.activo;
    const seguiraSiendo = rol === 'admin' && activo;
    if (eraAdminActivo && !seguiraSiendo && admins.length <= 1) {
      await cli.query('ROLLBACK');
      return NextResponse.json({ error: 'Tiene que quedar al menos un administrador activo' }, { status: 409 });
    }

    const sets: string[] = ['rol = $2', 'activo = $3'];
    const vals: unknown[] = [id, rol, activo];
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim().slice(0, 80);
      if (!nombre) {
        await cli.query('ROLLBACK');
        return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });
      }
      vals.push(nombre);
      sets.push(`nombre = $${vals.length}`);
    }
    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length < 8) {
        await cli.query('ROLLBACK');
        return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
      }
      vals.push(await bcrypt.hash(password, 10));
      sets.push(`password_hash = $${vals.length}`);
    }
    await cli.query(`UPDATE dados_usuarios SET ${sets.join(', ')} WHERE id = $1`, vals);
    await cli.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    console.error(e);
    return NextResponse.json({ error: 'No se pudo actualizar el usuario' }, { status: 500 });
  } finally {
    cli.release();
  }
}
