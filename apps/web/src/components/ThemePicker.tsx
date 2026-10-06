import { useEffect, useRef, useState } from 'react';
import { LOGOS, THEMES, useTheme } from '../context/ThemeContext.js';
import { HxLogo } from './HxLogo.js';

/** Floating button bottom-right that opens the style and logo choices. */
export function ThemePicker() {
  const { theme, setTheme, logo, setLogo } = useTheme();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'style' | 'logo'>('style');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="theme-picker" ref={ref}>
      {open && (
        <div className="theme-panel" role="dialog" aria-label="Personalizar">
          <div className="theme-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'style'} className={tab === 'style' ? 'active' : ''} onClick={() => setTab('style')}>Estilo</button>
            <button type="button" role="tab" aria-selected={tab === 'logo'} className={tab === 'logo' ? 'active' : ''} onClick={() => setTab('logo')}>Logo</button>
          </div>
          <div className="theme-panel-head">
            <span className="theme-panel-title">{tab === 'style' ? 'Estilo' : 'Logo'}</span>
            <span className="theme-panel-current">{tab === 'style' ? theme.name : LOGOS.find(l => l.id === logo)?.name}</span>
          </div>

          {tab === 'logo' && (
            <div className="logo-grid">
              {LOGOS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  className={`logo-option ${l.id === logo ? 'selected' : ''}`}
                  onClick={() => setLogo(l.id)}
                  aria-pressed={l.id === logo}
                >
                  <span className="logo-stage"><HxLogo variant={l.id} className="logo-preview" /></span>
                  <span className="theme-name">{l.name}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'style' && <div className="theme-grid">
            {THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                className={`theme-option ${t.id === theme.id ? 'selected' : ''}`}
                onClick={() => setTheme(t.id)}
                aria-pressed={t.id === theme.id}
              >
                {/* Static miniature of the style; styled per id in themes.css */}
                <span className={`pv pv-${t.id}`}>
                  <span className="pv-fx" />
                  <span className="pv-card">
                    <span className="pv-title">Aa</span>
                    <span className="pv-num">12.847</span>
                    <span className="pv-btn" />
                  </span>
                </span>
                <span className="theme-name">{t.name}</span>
                <span className="theme-desc">{t.desc}</span>
              </button>
            ))}
          </div>}
        </div>
      )}

      <button
        type="button"
        className={`theme-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Escolher estilo"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22z"/>
          <circle cx="7.5" cy="11" r="1.2" fill="currentColor"/>
          <circle cx="10.5" cy="6.8" r="1.2" fill="currentColor"/>
          <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
}
