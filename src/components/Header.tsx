'use client';

import Link from 'next/link';

const LINKS = [
  { href: '/', texto: 'Pedidos' },
  { href: '/kpis', texto: 'KPIs' },
  { href: '/reportes', texto: 'Reportes' },
];

export default function Header({ nombre, rol, actual }: { nombre: string; rol: string; actual: string }) {
  async function salir() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  const links = rol === 'admin' ? [...LINKS, { href: '/usuarios', texto: 'Usuarios' }] : LINKS;

  return (
    <header className="top">
      <h1>Dados</h1>
      <nav className="nav">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={actual === l.href ? 'page' : undefined}>
            {l.texto}
          </Link>
        ))}
      </nav>
      <span className="quien">
        {nombre} · {rol === 'admin' ? 'Admin' : 'Vendedor'}
      </span>
      <button className="link" onClick={salir}>Salir</button>
    </header>
  );
}
