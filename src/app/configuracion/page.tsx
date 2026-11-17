import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Shell from '@/components/Shell';
import Configuracion from '@/components/Configuracion';

export default async function PaginaConfiguracion() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  if (s.rol !== 'admin') redirect('/');
  return (
    <Shell nombre={s.nombre} rol={s.rol} actual="/configuracion" titulo="Configuración" subtitulo="avisos, horario y comportamiento del agente · solo administradores">
      <Configuracion />
    </Shell>
  );
}
