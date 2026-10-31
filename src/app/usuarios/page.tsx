import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Header from '@/components/Header';
import Usuarios from '@/components/Usuarios';

export default async function PaginaUsuarios() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  if (s.rol !== 'admin') redirect('/');
  return (
    <>
      <Header nombre={s.nombre} rol={s.rol} actual="/usuarios" />
      <Usuarios yo={s.usuario} />
    </>
  );
}
