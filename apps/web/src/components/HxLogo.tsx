import { useId, type ReactNode } from 'react';
import { useTheme, type LogoId } from '../context/ThemeContext.js';

interface HxLogoProps {
  className?: string;
  title?: string;
  /** Force a variant (picker previews); defaults to the saved choice. */
  variant?: LogoId;
}

/** The HX mark in the variant the user picked. Minimal variants take their colors from the active style. */
export function HxLogo({ className, title = 'HX', variant }: HxLogoProps) {
  const { logo } = useTheme();
  const v = variant ?? logo;
  if (v === 'neon') return <NeonMark className={className} title={title} />;
  return (
    <svg className={className} viewBox="0 0 48 32" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      {MINIMAL[v]}
    </svg>
  );
}

/* Minimal marks on a 48×32 grid. .hx-f / .hx-s = text color, .hx-af / .hx-as = accent (index.css). */

const PIXEL_H = ['10001', '10001', '10001', '11111', '10001', '10001', '10001'];
const PIXEL_X = ['10001', '10001', '01010', '00100', '01010', '10001', '10001'];

function pixels(rows: string[], x0: number, y0: number, cls: string) {
  const out: ReactNode[] = [];
  rows.forEach((row, r) =>
    [...row].forEach((on, c) => {
      if (on === '1') out.push(<rect key={`${cls}${r}-${c}`} className={cls} x={x0 + c * 3} y={y0 + r * 3} width="2.6" height="2.6" rx="0.4" />);
    }),
  );
  return out;
}

const MINIMAL: Record<Exclude<LogoId, 'neon'>, ReactNode> = {
  solid: (
    <>
      <path className="hx-f" d="M5 6h5v7.5h8V6h5v20h-5v-7.5h-8V26H5z" />
      <path className="hx-as" d="M28 6l15 20M43 6L28 26" strokeWidth="5" />
    </>
  ),
  line: (
    <g strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path className="hx-s" d="M7 7v18M21 7v18M7 16h14" />
      <path className="hx-as" d="M28 7l14 18M42 7L28 25" />
    </g>
  ),
  italic: (
    <g transform="translate(4 0) skewX(-12)">
      <path className="hx-f" d="M5 6h5v7.5h8V6h5v20h-5v-7.5h-8V26H5z" />
      <path className="hx-as" d="M28 6l14 20M42 6L28 26" strokeWidth="4.5" />
    </g>
  ),
  mono: (
    <g strokeWidth="4.5" strokeLinecap="square">
      <path className="hx-s" d="M9 7v18M9 16h21" />
      <path className="hx-as" d="M24 7l16 18M40 7L24 25" strokeLinecap="butt" />
    </g>
  ),
  tile: (
    <>
      <rect className="hx-af" x="10" y="2" width="28" height="28" rx="7" />
      <path className="hx-ink" d="M14.5 10h3v4.5h4V10h3v12h-3v-4.5h-4V22h-3z" />
      <path className="hx-inks" d="M26.5 10l7 12M33.5 10l-7 12" strokeWidth="2.8" />
    </>
  ),
  pixel: (
    <>
      {pixels(PIXEL_H, 7.5, 5.5, 'hx-f')}
      {pixels(PIXEL_X, 25.5, 5.5, 'hx-af')}
    </>
  ),
  ring: (
    <>
      <circle className="hx-as" cx="24" cy="16" r="14.5" strokeWidth="1.6" />
      <g strokeWidth="2.2" strokeLinecap="round">
        <path className="hx-s" d="M15 10v12M21 10v12M15 16h6" />
        <path className="hx-as" d="M26.5 10l7 12M33.5 10l-7 12" />
      </g>
    </>
  ),
  exp: (
    <>
      <path className="hx-f" d="M8 5h6v8.5h9V5h6v22h-6v-8h-9v8H8z" />
      <path className="hx-as" d="M33 5l8 10M41 5l-8 10" strokeWidth="3.2" strokeLinecap="round" />
    </>
  ),
};

/**
 * Neon mark: slanted chrome "H" with a neon rim, over a brushed neon-green "X".
 */
function NeonMark({ className, title = 'HX' }: { className?: string; title?: string }) {
  // Unique ids: the mark renders more than once per page (sidebar, topbar, login).
  const id = useId().replace(/:/g, '');
  const chrome = `hx-chrome-${id}`;
  const bevel = `hx-bevel-${id}`;
  const neon = `hx-neon-${id}`;
  const glow = `hx-glow-${id}`;
  const H = 'M6 12 H22 V40 H38 V12 H54 V88 H38 V56 H22 V88 H6 Z';

  return (
    <svg className={className} viewBox="0 0 140 100" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={chrome} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#e6ebe8" />
          <stop offset="0.48" stopColor="#8b958f" />
          <stop offset="0.55" stopColor="#c4ccc7" />
          <stop offset="0.78" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9da7a1" />
        </linearGradient>
        <linearGradient id={bevel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={neon} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e4ffa8" />
          <stop offset="0.35" stopColor="#6dff2a" />
          <stop offset="1" stopColor="#1fbf08" />
        </linearGradient>
        <filter id={glow} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* X: two tapered brush strokes with dry-brush splinters */}
      <g className="hx-x">
        <g filter={`url(#${glow})`} fill={`url(#${neon})`}>
          {/* "\" stroke */}
          <path d="M58 1 L80 5 L137 90 L131 99 L119 97 L66 13 Z" stroke="#0a0e0b" strokeWidth="1.4" strokeLinejoin="round" />
          {/* "/" stroke */}
          <path d="M139 1 L134 15 L82 97 L62 99 L67 89 L121 5 Z" stroke="#0a0e0b" strokeWidth="1.4" strokeLinejoin="round" />
          {/* splinters */}
          <path d="M52 7 L66 9 L68 12 Z" />
          <path d="M84 4 L92 3 L88 8 Z" />
          <path d="M127 99 L139 96 L136 100 Z" />
          <path d="M55 96 L68 93 L66 97 Z" />
          <path d="M131 3 L140 0 L136 6 Z" />
          <path d="M74 20 L77 19 L112 74 L110 76 Z" opacity="0.55" />
          <path d="M126 22 L128 24 L92 80 L90 79 Z" opacity="0.55" />
        </g>
        {/* wet highlights along the strokes */}
        <g fill="#f4ffdc">
          <path d="M64 5 L76 7 L129 87 L126 89 Z" opacity="0.6" />
          <path d="M134 5 L136 8 L81 94 L77 94 Z" opacity="0.45" />
        </g>
        {/* dry-brush cracks */}
        <g stroke="#0a0e0b" strokeWidth="1" strokeLinecap="round" opacity="0.7">
          <path d="M84 30 L99 54" />
          <path d="M108 66 L118 82" />
          <path d="M118 30 L104 52" />
          <path d="M92 72 L84 85" />
        </g>
      </g>

      {/* H: slanted chrome with a dark keyline and neon rim */}
      <g transform="translate(26 0) skewX(-14)">
        <path d={H} fill="none" stroke="#39ff14" strokeWidth="6.5" strokeLinejoin="round" filter={`url(#${glow})`} />
        <path d={H} fill={`url(#${chrome})`} stroke="#0a0e0b" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M8.5 14.5 H19.5 V42.5 H40.5 V14.5 H51.5 V21 H40.5 V49 H19.5 V21 H8.5 Z" fill={`url(#${bevel})`} opacity="0.6" />
      </g>
    </svg>
  );
}
