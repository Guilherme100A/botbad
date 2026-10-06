import { useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { engineStatus } from '../mock/data.js';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const NAV_MAIN: NavItem[] = [
  {
    path: '/',
    label: 'Visao geral',
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
    label: 'Trafego recente',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  },
  {
    path: '/history',
    label: 'Historico',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
];

const NAV_SYSTEM: NavItem[] = [
  {
    path: '/engine',
    label: 'Motor JEV',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>,
  },
  {
    path: '/settings',
    label: 'Configuracoes',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Visao geral',
  '/campaigns': 'Campanhas',
  '/traffic': 'Trafego recente',
  '/history': 'Historico',
  '/engine': 'Motor JEV',
  '/settings': 'Configuracoes',
};

const PAGE_SUBTITLES: Record<string, string> = {
  '/': 'Resumo do roteador de trafego',
  '/campaigns': 'Gerencie campanhas de roteamento',
  '/traffic': 'Decisoes de roteamento em tempo real',
  '/history': 'Historico completo de eventos',
  '/engine': 'Configuracao e saude do motor',
  '/settings': 'Organizacao, papeis e limites',
};

interface LayoutProps {
  route: string;
  children: ReactNode;
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

  return (
    <div className="layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="sidebar-logo-text">JEV Router</span>
        </div>

        <div className="sidebar-nav">
          <NavGroup label="Principal" items={NAV_MAIN} route={route} onNavigate={() => setSidebarOpen(false)} />
          <div className="sidebar-divider" />
          <NavGroup label="Monitoramento" items={NAV_MONITOR} route={route} onNavigate={() => setSidebarOpen(false)} />
          <div className="sidebar-divider" />
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
            Motor {healthy ? 'operacional' : 'indisponivel'} — v0.1
          </div>
        </div>
      </nav>

      <div className="main-area">
        <div className="page-header">
          <div className="page-header-left">
            <button
              className="hamburger"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Abrir menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className="page-title">{PAGE_TITLES[route] ?? ''}</h1>
            <span className="page-subtitle">{PAGE_SUBTITLES[route] ?? ''}</span>
          </div>
          <span className="demo-badge" />
        </div>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
