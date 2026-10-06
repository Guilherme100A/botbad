import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface Theme {
  id: string;
  name: string;
  /** Accent as "r, g, b". */
  accent: string;
  /** Text color on top of the accent. */
  ink: string;
  /** Background glow orb, "r, g, b". */
  orb: string;
  /** Glass surface tint, "r, g, b". */
  glass: string;
  glassDeep: string;
  /** Top-of-page background tint. */
  bgTint: string;
  rain: { color: string; head: string; glow: number; opacity: number; density: number; interval: number };
  /** Override when the accent would clash with the "alternative/negative" red. */
  negative?: string;
}

export const THEMES: Theme[] = [
  {
    id: 'matrix', name: 'Matrix',
    accent: '0, 255, 106', ink: '#001a0b', orb: '0, 150, 60', glass: '10, 13, 11', glassDeep: '4, 8, 5', bgTint: '#020a05',
    rain: { color: '#14b04e', head: '#7dffb0', glow: 14, opacity: 0.8, density: 0.65, interval: 70 },
  },
  {
    id: 'deep', name: 'Verde profundo',
    accent: '0, 200, 83', ink: '#00140a', orb: '0, 90, 40', glass: '6, 12, 8', glassDeep: '2, 6, 3', bgTint: '#010703',
    rain: { color: '#0b6b2e', head: '#2fd46b', glow: 10, opacity: 0.9, density: 0.9, interval: 55 },
  },
  {
    id: 'emerald', name: 'Esmeralda',
    accent: '43, 255, 177', ink: '#00170f', orb: '0, 140, 100', glass: '9, 14, 13', glassDeep: '3, 8, 7', bgTint: '#020a08',
    rain: { color: '#12a37a', head: '#9dffe0', glow: 14, opacity: 0.75, density: 0.6, interval: 70 },
  },
  {
    id: 'toxic', name: 'Tóxico',
    accent: '182, 255, 0', ink: '#141a00', orb: '110, 150, 0', glass: '12, 14, 9', glassDeep: '6, 8, 3', bgTint: '#080a02',
    rain: { color: '#7fae0c', head: '#e6ff8a', glow: 14, opacity: 0.75, density: 0.6, interval: 65 },
  },
  {
    id: 'cyber', name: 'Ciano',
    accent: '0, 229, 255', ink: '#00161a', orb: '0, 110, 140', glass: '9, 12, 15', glassDeep: '3, 6, 9', bgTint: '#02080b',
    rain: { color: '#0b8fa6', head: '#a6f6ff', glow: 14, opacity: 0.75, density: 0.6, interval: 70 },
  },
  {
    id: 'blue', name: 'Pílula azul',
    accent: '61, 139, 255', ink: '#ffffff', orb: '30, 70, 170', glass: '10, 12, 18', glassDeep: '4, 6, 12', bgTint: '#03060d',
    rain: { color: '#2c5fb8', head: '#b5d1ff', glow: 14, opacity: 0.75, density: 0.6, interval: 75 },
  },
  {
    id: 'red', name: 'Pílula vermelha',
    accent: '255, 59, 59', ink: '#ffffff', orb: '150, 20, 20', glass: '16, 10, 10', glassDeep: '9, 4, 4', bgTint: '#0b0303',
    rain: { color: '#a3201f', head: '#ffb3b3', glow: 14, opacity: 0.7, density: 0.6, interval: 70 },
    negative: '#ff9f0a',
  },
  {
    id: 'amber', name: 'Âmbar',
    accent: '255, 176, 0', ink: '#1a1200', orb: '150, 90, 0', glass: '15, 13, 9', glassDeep: '8, 6, 3', bgTint: '#0a0702',
    rain: { color: '#a8720a', head: '#ffe099', glow: 12, opacity: 0.7, density: 0.55, interval: 80 },
  },
  {
    id: 'violet', name: 'Violeta',
    accent: '178, 107, 255', ink: '#ffffff', orb: '90, 40, 160', glass: '13, 10, 17', glassDeep: '7, 4, 11', bgTint: '#07030c',
    rain: { color: '#6c3fb0', head: '#e2ccff', glow: 14, opacity: 0.75, density: 0.6, interval: 70 },
  },
  {
    id: 'mono', name: 'Grafite',
    accent: '235, 235, 240', ink: '#000000', orb: '70, 70, 80', glass: '12, 12, 13', glassDeep: '6, 6, 7', bgTint: '#060607',
    rain: { color: '#5a5a62', head: '#ffffff', glow: 8, opacity: 0.6, density: 0.5, interval: 85 },
  },
];

const KEY = 'jev_theme';
const DEFAULT = THEMES[0]!;

function load(): Theme {
  try {
    const id = localStorage.getItem(KEY);
    return THEMES.find(t => t.id === id) ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function apply(t: Theme) {
  const s = document.documentElement.style;
  s.setProperty('--accent', `rgb(${t.accent})`);
  s.setProperty('--accent-rgb', t.accent);
  s.setProperty('--accent-ink', t.ink);
  s.setProperty('--orb-rgb', t.orb);
  s.setProperty('--glass-rgb', t.glass);
  s.setProperty('--glass-deep-rgb', t.glassDeep);
  s.setProperty('--bg-tint', t.bgTint);
  s.setProperty('--rain-opacity', String(t.rain.opacity));
  if (t.negative) {
    s.setProperty('--negative', t.negative);
    s.setProperty('--negative-soft', `${t.negative}1f`);
  } else {
    s.removeProperty('--negative');
    s.removeProperty('--negative-soft');
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bgTint);
  document.documentElement.dataset.theme = t.id;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(load);

  useEffect(() => { apply(theme); }, [theme]);

  const setTheme = (id: string) => {
    const t = THEMES.find(x => x.id === id);
    if (!t) return;
    setThemeState(t);
    try { localStorage.setItem(KEY, id); } catch { /* noop */ }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
