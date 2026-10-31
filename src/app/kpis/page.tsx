import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Header from '@/components/Header';
import Kpis from '@/components/Kpis';

export default async function PaginaKpis() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return (
    <>
      <Header nombre={s.nombre} rol={s.rol} actual="/kpis" />
      <Kpis />
    </>
  );
}
