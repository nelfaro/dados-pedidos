import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Shell from '@/components/Shell';
import Usuarios from '@/components/Usuarios';

export default async function PaginaUsuarios() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  if (s.rol !== 'admin') redirect('/');
  return (
    <Shell nombre={s.nombre} rol={s.rol} actual="/usuarios" titulo="Usuarios" subtitulo="roles y accesos · solo administradores">
      <Usuarios yo={s.usuario} />
    </Shell>
  );
}
