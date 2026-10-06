import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface RainConfig {
  color: string;
  head: string;
  glow: number;
  density: number;
  interval: number;
}

export interface Theme {
  id: string;
  name: string;
  /** One-line description shown in the picker. */
  desc: string;
  /** Browser chrome color. */
  meta: string;
  /** Digital rain in the background; omitted for styles that use other effects. */
  rain?: RainConfig;
}

/** Visual styles. Colors, type, shape and background effects live in themes.css under [data-theme]. */
export const THEMES: Theme[] = [
  {
    id: 'fusion', name: 'Fusão', desc: 'Soft + Cyberpunk + Matrix', meta: '#0c100e',
    rain: { color: '#14b04e', head: '#ff2a6d', glow: 12, density: 0.55, interval: 70 },
  },
  {
    id: 'matrix', name: 'Matrix', desc: 'Vidro escuro e chuva neon', meta: '#000000',
    rain: { color: '#14b04e', head: '#7dffb0', glow: 14, density: 0.65, interval: 70 },
  },
  { id: 'terminal', name: 'Terminal', desc: 'Monitor CRT de fósforo', meta: '#010401' },
  { id: 'brutal', name: 'Brutalista', desc: 'Bordas grossas, sombra dura', meta: '#f1efe7' },
  {
    id: 'cyber', name: 'Cyberpunk', desc: 'Cantos cortados e glitch', meta: '#07000f',
    rain: { color: '#00b8c4', head: '#fcee0a', glow: 10, density: 0.25, interval: 60 },
  },
  {
    id: 'light', name: 'Claro', desc: 'Minimalismo Apple claro', meta: '#f5f5f7',
    rain: { color: '#c4c8ce', head: '#8e8e93', glow: 0, density: 0.35, interval: 90 },
  },
  { id: 'blueprint', name: 'Blueprint', desc: 'Planta técnica', meta: '#0b3a8c' },
  { id: 'aurora', name: 'Aurora', desc: 'Vidro sobre luzes vivas', meta: '#05060a' },
  { id: 'synth', name: 'Synthwave', desc: 'Sol retrô e grade neon', meta: '#0d0221' },
  { id: 'editorial', name: 'Editorial', desc: 'Papel e tipografia serifada', meta: '#f4efe6' },
  { id: 'soft', name: 'Soft', desc: 'Neumorfismo escuro', meta: '#1c1f24' },
];

// v2: new default (Fusão) shows up even for browsers that saved a previous pick.
const KEY = 'jev_theme_v2';
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
  const root = document.documentElement;
  root.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.meta);
}

/** HX mark variants; drawn in components/HxLogo.tsx. */
export const LOGOS = [
  { id: 'solid', name: 'Sólida' },
  { id: 'line', name: 'Linha' },
  { id: 'italic', name: 'Itálica' },
  { id: 'mono', name: 'Monograma' },
  { id: 'tile', name: 'Bloco' },
  { id: 'pixel', name: 'Pixel' },
  { id: 'ring', name: 'Anel' },
  { id: 'exp', name: 'Expoente' },
  { id: 'neon', name: 'Neon' },
] as const;

export type LogoId = (typeof LOGOS)[number]['id'];

const LOGO_KEY = 'jev_logo';
const DEFAULT_LOGO: LogoId = 'solid';

function loadLogo(): LogoId {
  try {
    const id = localStorage.getItem(LOGO_KEY);
    return LOGOS.find(l => l.id === id)?.id ?? DEFAULT_LOGO;
  } catch {
    return DEFAULT_LOGO;
  }
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (id: string) => void;
  logo: LogoId;
  setLogo: (id: LogoId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(load);
  const [logo, setLogoState] = useState<LogoId>(loadLogo);

  useEffect(() => { apply(theme); }, [theme]);

  const setTheme = (id: string) => {
    const t = THEMES.find(x => x.id === id);
    if (!t) return;
    setThemeState(t);
    try { localStorage.setItem(KEY, id); } catch { /* noop */ }
  };

  const setLogo = (id: LogoId) => {
    setLogoState(id);
    try { localStorage.setItem(LOGO_KEY, id); } catch { /* noop */ }
  };

  return <ThemeContext.Provider value={{ theme, setTheme, logo, setLogo }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
