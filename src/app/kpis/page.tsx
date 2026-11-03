import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Shell from '@/components/Shell';
import Kpis from '@/components/Kpis';

export default async function PaginaKpis() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return (
    <Shell nombre={s.nombre} rol={s.rol} actual="/kpis" titulo="KPIs" subtitulo="cómo se mueven los pedidos">
      <Kpis />
    </Shell>
  );
}
