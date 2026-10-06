import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Layout } from './components/Layout.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Campaigns } from './pages/Campaigns.js';
import { Traffic } from './pages/Traffic.js';
import { History } from './pages/History.js';
import { Engine } from './pages/Engine.js';
import { Settings } from './pages/Settings.js';

type Route = '/' | '/campaigns' | '/traffic' | '/history' | '/engine' | '/settings' | '/login';

const VALID_ROUTES: Route[] = ['/', '/campaigns', '/traffic', '/history', '/engine', '/settings', '/login'];

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/';
  return VALID_ROUTES.includes(hash as Route) ? (hash as Route) : '/';
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}

const PAGES: Record<string, () => React.JSX.Element> = {
  '/': Dashboard,
  '/campaigns': Campaigns,
  '/traffic': Traffic,
  '/history': History,
  '/engine': Engine,
  '/settings': Settings,
};

function AppRoutes() {
  const route = useRoute();
  const { isAuthenticated } = useAuth();

  if (route === '/login') {
    return <Login />;
  }

  if (!isAuthenticated) {
    window.location.hash = '#/login';
    return <Login />;
  }

  const Page = PAGES[route] ?? Dashboard;

  return (
    <Layout route={route}>
      <Page />
    </Layout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
