'use client';

import { useEffect, useState } from 'react';
import Icono from './Icono';

export const CLAVE_TEMA = 'dados_tema';

export default function ThemeToggle() {
  // Antes de montar no se sabe el tema (lo fija un script en <head>), asi que se muestra neutro.
  const [tema, setTema] = useState<'dark' | 'light' | null>(null);

  useEffect(() => {
    setTema(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  function alternar() {
    const nuevo = tema === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nuevo;
    setTema(nuevo);
    try {
      localStorage.setItem(CLAVE_TEMA, nuevo);
    } catch {
      /* sin almacenamiento: el cambio vale solo para esta sesion */
    }
  }

  const aNoche = tema === 'light';
  return (
    <button
      className="btn btn-secondary btn-icon"
      onClick={alternar}
      title={aNoche ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
      aria-label={aNoche ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
    >
      <Icono n={aNoche ? 'luna' : 'sol'} size={17} />
    </button>
  );
}
