import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Header from '@/components/Header';
import Reportes from '@/components/Reportes';

export default async function PaginaReportes() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return (
    <>
      <Header nombre={s.nombre} rol={s.rol} actual="/reportes" />
      <Reportes generadoPor={s.nombre} />
    </>
  );
}
