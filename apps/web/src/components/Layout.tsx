import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { engineStatus } from '../mock/data.js';
import { Scramble } from './Scramble.js';

const SPOT_SELECTOR = '.card, .hero, .campaign-card, .list, .info-item, .sim-card, .table-wrap';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const NAV_MAIN: NavItem[] = [
  {
    path: '/',
    label: 'Visão geral',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    path: '/campaigns',
    label: 'Campanhas',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  },
];

const NAV_MONITOR: NavItem[] = [
  {
    path: '/traffic',
    label: 'Tráfego recente',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  },
  {
    path: '/history',
    label: 'Histórico',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
];

const NAV_SYSTEM: NavItem[] = [
  {
    path: '/engine',
    label: 'Motor Jev',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>,
  },
  {
    path: '/settings',
    label: 'Configurações',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Visão geral',
  '/campaigns': 'Campanhas',
  '/traffic': 'Tráfego recente',
  '/history': 'Histórico',
  '/engine': 'Motor Jev',
  '/settings': 'Configurações',
};

const PAGE_SUBTITLES: Record<string, string> = {
  '/': 'Resumo do roteador de tráfego',
  '/campaigns': 'Gerencie campanhas de roteamento',
  '/traffic': 'Decisões de roteamento em tempo real',
  '/history': 'Histórico completo de eventos',
  '/engine': 'Configuração e saúde do motor',
  '/settings': 'Organização, papéis e limites',
};

interface LayoutProps {
  route: string;
  children: ReactNode;
}

export function Logo() {
  return (
    <>
      <div className="sidebar-logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <span className="sidebar-logo-text">Jev router</span>
    </>
  );
}

function NavGroup({ label, items, route, onNavigate }: { label: string; items: NavItem[]; route: string; onNavigate: () => void }) {
  return (
    <>
      <div className="sidebar-section-label">{label}</div>
      {items.map(item => (
        <a
          key={item.path}
          href={`#${item.path}`}
          className={`sidebar-link ${route === item.path ? 'active' : ''}`}
          onClick={onNavigate}
        >
          {item.icon}
          {item.label}
        </a>
      ))}
    </>
  );
}

export function Layout({ route, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();
  const healthy = engineStatus.healthy;

  // Cursor-following glow on surfaces: one listener, CSS does the rest.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(SPOT_SELECTOR);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div className="layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Logo />
        </div>

        <div className="sidebar-nav">
          <NavGroup label="Principal" items={NAV_MAIN} route={route} onNavigate={() => setSidebarOpen(false)} />
          <NavGroup label="Monitoramento" items={NAV_MONITOR} route={route} onNavigate={() => setSidebarOpen(false)} />
          <NavGroup label="Sistema" items={NAV_SYSTEM} route={route} onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-profile" onClick={logout}>
            <div className="sidebar-avatar">O</div>
            <div className="sidebar-profile-info">
              <div className="sidebar-profile-name">Operador</div>
              <div className="sidebar-profile-role">Sair da conta</div>
            </div>
          </div>
          <div className="sidebar-status">
            <span className={`sidebar-status-dot ${healthy ? 'ok' : 'err'}`} />
            Motor {healthy ? 'operacional' : 'indisponível'}
            <span className="num">v0.1</span>
          </div>
        </div>
      </nav>

      <div className="main-area">
        <header className="topbar">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Abrir menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="8" x2="20" y2="8"/>
              <line x1="4" y1="16" x2="20" y2="16"/>
            </svg>
          </button>
          <Logo />
        </header>

        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">
              <Scramble key={route} text={PAGE_TITLES[route] ?? ''} duration={520} caret />
            </h1>
            <span className="page-subtitle">{PAGE_SUBTITLES[route] ?? ''}</span>
          </div>
        </div>

        <main className="page-content" key={route}>
          {children}
        </main>
      </div>
    </div>
  );
}
