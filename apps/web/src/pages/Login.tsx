import { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';

export function Login() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email é obrigatório.'); return; }
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
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>JEV Traffic Router</span>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-box">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@exemplo.com"
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
              placeholder="********"
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="form-hint" style={{ textAlign: 'center', marginTop: 16 }}>
            Ambiente de desenvolvimento. Qualquer email/senha aceito.
          </div>
        </form>
      </div>
    </div>
  );
}
