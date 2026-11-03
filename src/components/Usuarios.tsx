'use client';

import { useCallback, useEffect, useState } from 'react';

type Usuario = { id: number; usuario: string; nombre: string; rol: 'admin' | 'vendedor'; activo: boolean; alta: string };

export default function Usuarios({ yo }: { yo: string }) {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch('/api/usuarios', { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/';
      return;
    }
    if (res.ok) setLista((await res.json()).usuarios);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function modificar(u: Usuario, cambios: Record<string, unknown>, ok: string) {
    setError('');
    setAviso('');
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setError(j.error || 'No se pudo guardar.');
    else setAviso(ok);
    cargar();
  }

  function resetear(u: Usuario) {
    const clave = prompt(`Nueva contraseña para ${u.usuario} (mínimo 8 caracteres):`);
    if (clave) modificar(u, { password: clave }, `Contraseña de ${u.usuario} actualizada.`);
  }

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setAviso('');
    setCreando(true);
    const form = e.currentTarget;
    const f = new FormData(form);
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: f.get('usuario'),
        nombre: f.get('nombre'),
        password: f.get('password'),
        rol: f.get('rol'),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setCreando(false);
    if (!res.ok) return setError(j.error || 'No se pudo crear el usuario.');
    setAviso('Usuario creado.');
    form.reset();
    cargar();
  }

  return (
    <>
      <p className="fecha">
        <b>Admin</b>: todo, incluida la gestión de usuarios. <b>Vendedor</b>: pedidos, KPIs y reportes.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {aviso && <p className="ok" role="status">{aviso}</p>}

      <form className="card panel form-linea" onSubmit={crear}>
        <label className="campo">Usuario<input name="usuario" required autoCapitalize="none" autoComplete="off" /></label>
        <label className="campo">Nombre<input name="nombre" required autoComplete="off" /></label>
        <label className="campo">Contraseña<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <label className="campo">
          Rol
          <select name="rol" defaultValue="vendedor">
            <option value="vendedor">Vendedor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="btn btn-primary" disabled={creando}>{creando ? 'Creando…' : 'Agregar usuario'}</button>
      </form>

      <div className="card tabla-wrap" style={{ padding: 8 }}>
        <table className="tabla">
          <thead>
            <tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Alta</th><th>Estado</th><th /></tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
                <td>{u.usuario}{u.usuario === yo && <span className="fecha"> (vos)</span>}</td>
                <td>{u.nombre}</td>
                <td>
                  <select
                    aria-label={`Rol de ${u.usuario}`}
                    value={u.rol}
                    onChange={(e) => modificar(u, { rol: e.target.value }, `Rol de ${u.usuario} actualizado.`)}
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{u.alta}</td>
                <td><span className={u.activo ? 'tag tag-ok' : 'tag tag-neutral'}>{u.activo ? 'Activo' : 'Desactivado'}</span></td>
                <td className="derecha">
                  <button className="link" onClick={() => resetear(u)}>Cambiar clave</button>{' '}
                  <button
                    className="link"
                    onClick={() => modificar(u, { activo: !u.activo }, u.activo ? `${u.usuario} desactivado.` : `${u.usuario} reactivado.`)}
                  >
                    {u.activo ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
