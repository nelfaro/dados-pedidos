'use client';

import { useState } from 'react';

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
    <main className="login">
      <form onSubmit={enviar}>
        <h1>Pedidos · Dados</h1>
        <label>
          Usuario
          <input name="usuario" autoComplete="username" autoCapitalize="none" required autoFocus />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </main>
  );
}
