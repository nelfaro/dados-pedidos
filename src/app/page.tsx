import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Tablero from '@/components/Tablero';

export default async function Home() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return <Tablero nombre={s.nombre} />;
}
