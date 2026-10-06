import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { login as apiLogin, getSession, getToken, clearToken, type Session } from '../api/client.js';

interface AuthState {
  token: string | null;
  session: Session | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: getToken(), session: null, loading: false });

  // A stored token may be expired or revoked: confirm it once and load who we are.
  useEffect(() => {
    if (!state.token || state.session) return;
    let cancelled = false;
    getSession()
      .then(session => { if (!cancelled) setState(s => ({ ...s, session })); })
      .catch(() => {
        // Network down: keep the token and let pages fall back. 401 is handled by the client (clears token).
        if (!cancelled && !getToken()) setState({ token: null, session: null, loading: false });
      });
    return () => { cancelled = true; };
  }, [state.token, state.session]);

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const { token, ...session } = await apiLogin(email, password);
      setState({ token, session, loading: false });
    } catch (err) {
      setState(s => ({ ...s, loading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ token: null, session: null, loading: false });
    window.location.hash = '#/login';
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    isAuthenticated: state.token != null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
