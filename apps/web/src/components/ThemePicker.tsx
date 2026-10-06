import { useEffect, useRef, useState } from 'react';
import { THEMES, useTheme } from '../context/ThemeContext.js';

/** Floating button bottom-right that opens a grid of the available themes. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
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
        <div className="theme-panel" role="dialog" aria-label="Escolher tema">
          <div className="theme-panel-head">
            <span className="theme-panel-title">Tema</span>
            <span className="theme-panel-current">{theme.name}</span>
          </div>
          <div className="theme-grid">
            {THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                className={`theme-option ${t.id === theme.id ? 'selected' : ''}`}
                onClick={() => setTheme(t.id)}
                aria-pressed={t.id === theme.id}
                title={t.name}
              >
                <span
                  className="theme-swatch"
                  style={{
                    background: `radial-gradient(circle at 70% 20%, rgba(${t.orb}, 0.9), transparent 70%), ${t.bgTint}`,
                    ['--sw' as string]: `rgb(${t.accent})`,
                    ['--sw-rain' as string]: t.rain.color,
                  }}
                >
                  <span className="theme-swatch-rain">1<br />0<br />7</span>
                  <span className="theme-swatch-rain r2">4<br />9<br />2</span>
                  <span className="theme-swatch-rain r3">0<br />3<br />8</span>
                  <span className="theme-swatch-dot" />
                </span>
                <span className="theme-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`theme-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Escolher tema"
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
