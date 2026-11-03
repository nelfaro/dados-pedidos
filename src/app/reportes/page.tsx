import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Shell from '@/components/Shell';
import Reportes from '@/components/Reportes';

export default async function PaginaReportes() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return (
    <Shell nombre={s.nombre} rol={s.rol} actual="/reportes" titulo="Reportes" subtitulo="pedidos gestionados · imprimible en PDF">
      <Reportes generadoPor={s.nombre} />
    </Shell>
  );
}
