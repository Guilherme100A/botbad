import { useState, useEffect } from 'react';
import { Layout } from './components/Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { Campaigns } from './pages/Campaigns.js';
import { Traffic } from './pages/Traffic.js';
import { History } from './pages/History.js';
import { Engine } from './pages/Engine.js';
import { Settings } from './pages/Settings.js';

type Route = '/' | '/campaigns' | '/traffic' | '/history' | '/engine' | '/settings';

const VALID_ROUTES: Route[] = ['/', '/campaigns', '/traffic', '/history', '/engine', '/settings'];

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

const PAGES: Record<Route, () => React.JSX.Element> = {
  '/': Dashboard,
  '/campaigns': Campaigns,
  '/traffic': Traffic,
  '/history': History,
  '/engine': Engine,
  '/settings': Settings,
};

export function App() {
  const route = useRoute();
  const Page = PAGES[route];

  return (
    <Layout route={route}>
      <Page />
    </Layout>
  );
}
