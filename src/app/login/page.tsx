'use client';

import { useState } from 'react';
import Icono from '@/components/Icono';
import ThemeToggle from '@/components/ThemeToggle';

export default function Login() {
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: f.get('usuario'), password: f.get('password') }),
    });
    if (res.ok) {
      window.location.href = '/';
      return;
    }
    const j = await res.json().catch(() => ({}));
    setError(j.error || 'No se pudo ingresar');
    setEnviando(false);
  }

  return (
    <div className="app" style={{ display: 'block' }}>
      <div className="login-tema"><ThemeToggle /></div>
      <main className="login">
        <form className="card login-form" onSubmit={enviar}>
          <div className="marca">
            <div className="marca-logo"><Icono n="caja" size={16} /></div>
            <div className="marca-txt">
              <b>Dados</b>
              <small>Pedidos</small>
            </div>
          </div>
          <h1>Ingresá a tu panel</h1>
          <label className="campo">
            Usuario
            <input name="usuario" autoComplete="username" autoCapitalize="none" required autoFocus />
          </label>
          <label className="campo">
            Contraseña
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
      </main>
    </div>
  );
}
