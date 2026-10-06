import { useId } from 'react';

interface HxLogoProps {
  className?: string;
  title?: string;
}

/**
 * HX mark: slanted chrome "H" with a neon rim, over a brushed neon-green "X".
 * Vector so it stays crisp at any size; transparent so it sits on any style.
 */
export function HxLogo({ className, title = 'HX' }: HxLogoProps) {
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
