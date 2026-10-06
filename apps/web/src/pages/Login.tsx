import { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { BackgroundFx } from '../components/Layout.js';
import { HxLogo } from '../components/HxLogo.js';

export function Login() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('E-mail é obrigatório.'); return; }
    if (!password) { setError('Senha é obrigatória.'); return; }

    try {
      await login(email, password);
      window.location.hash = '#/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.');
    }
  }

  return (
    <div className="login-page">
      <BackgroundFx />
      <div className="login-card">
        <div className="login-logo">
          <HxLogo className="brand-logo brand-logo-lg" />
          <h1 className="login-title">Jev router</h1>
          <p className="login-sub">Entre para continuar</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-box">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="form-hint" style={{ textAlign: 'center', marginTop: 20 }}>
            Use a conta criada no seed (npm run db:seed)
          </div>
        </form>
      </div>
    </div>
  );
}
