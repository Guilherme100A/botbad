import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { login as apiLogin, getToken, clearToken, setToken } from '../api/client.js';

interface AuthState {
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_USER_ID = '00000000-0000-4000-a000-000000000001';
const MOCK_TENANT_ID = '00000000-0000-4000-a000-000000000001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: getToken(),
    loading: false,
  });

  useEffect(() => {
    const stored = getToken();
    if (stored && stored !== state.token) {
      setState(s => ({ ...s, token: stored }));
    }
  }, []);

  const login = useCallback(async (_email: string, _password: string) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const token = await apiLogin(MOCK_USER_ID, MOCK_TENANT_ID, 'owner');
      setState({ token, loading: false });
    } catch (err) {
      setState(s => ({ ...s, loading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ token: null, loading: false });
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
