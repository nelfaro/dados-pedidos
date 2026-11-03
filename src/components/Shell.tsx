'use client';

import Link from 'next/link';
import Icono from './Icono';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { href: '/', texto: 'Pedidos', icono: 'tablero' as const },
  { href: '/kpis', texto: 'KPIs', icono: 'grafico' as const },
  { href: '/reportes', texto: 'Reportes', icono: 'reporte' as const },
];

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}

export default function Shell({
  nombre,
  rol,
  actual,
  titulo,
  subtitulo,
  ancho = false,
  children,
}: {
  nombre: string;
  rol: string;
  actual: string;
  titulo: string;
  subtitulo?: string;
  ancho?: boolean;
  children: React.ReactNode;
}) {
  async function salir() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  const links = rol === 'admin' ? [...LINKS, { href: '/usuarios', texto: 'Usuarios', icono: 'usuarios' as const }] : LINKS;

  return (
    <div className="app">
      <aside className="side">
        <div className="marca">
          <div className="marca-logo"><Icono n="caja" size={16} /></div>
          <div className="marca-txt">
            <b>Dados</b>
            <small>Pedidos</small>
          </div>
        </div>
        <nav className="side-nav" aria-label="Principal">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-item"
              title={l.texto}
              aria-current={actual === l.href ? 'page' : undefined}
            >
              <Icono n={l.icono} />
              <span>{l.texto}</span>
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="usuario" title={`${nombre} · ${rol === 'admin' ? 'Admin' : 'Vendedor'}`}>
            <span className="avatar">{iniciales(nombre)}</span>
            <div className="usuario-txt">
              <b>{nombre}</b>
              <small>{rol === 'admin' ? 'Admin' : 'Vendedor'}</small>
            </div>
          </div>
          <button className="nav-item" onClick={salir} title="Salir" style={{ border: 0, background: 'none', width: '100%' }}>
            <Icono n="salir" />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-titulo">
            <h1>{titulo}</h1>
            {subtitulo && <div className="sub">{subtitulo}</div>}
          </div>
          <div className="topbar-acc">
            <ThemeToggle />
          </div>
        </header>
        <div className={ancho ? 'page ancho' : 'page'}>{children}</div>
      </main>
    </div>
  );
}
