import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Shell from '@/components/Shell';
import Tablero from '@/components/Tablero';

export default async function Home() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return (
    <Shell nombre={s.nombre} rol={s.rol} actual="/" titulo="Pedidos" subtitulo="pipeline · por cobrar → pagado → listo → entregado" ancho>
      <Tablero />
    </Shell>
  );
}
