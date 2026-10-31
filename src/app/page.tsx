import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import Header from '@/components/Header';
import Tablero from '@/components/Tablero';

export default async function Home() {
  const s = await sesionActual();
  if (!s) redirect('/login');
  return (
    <>
      <Header nombre={s.nombre} rol={s.rol} actual="/" />
      <Tablero />
    </>
  );
}
