import { useEffect, useRef } from 'react';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';

interface MatrixRainProps {
  className?: string;
  /** Glyph size in px. */
  size?: number;
  /** Ms between frames; higher is slower. */
  interval?: number;
  /** 0–1 chance a column is active; lower is sparser. */
  density?: number;
  /** Trail glyph color. */
  color?: string;
  /** Color of the occasional bright glyph. */
  headColor?: string;
  /** Neon bloom around glyphs, in px. 0 disables. */
  glow?: number;
}

/** Low-key digital rain on a transparent canvas. Decorative; respects reduced motion, pauses off-screen. */
export function MatrixRain({
  className = 'matrix-rain',
  size = 16,
  interval = 60,
  density = 1,
  color = '#00ff6a',
  headColor = '#d8ffe6',
  glow = 0,
}: MatrixRainProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let drops: number[] = [];
    let active: boolean[] = [];
    let raf = 0;
    let last = 0;
    let visible = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(canvas.clientWidth / size);
      const rows = Math.ceil(canvas.clientHeight / size);
      // Spread starts so some columns are already mid-fall on first paint.
      drops = Array.from({ length: cols }, () => (Math.random() * 1.4 - 1) * rows);
      active = Array.from({ length: cols }, () => Math.random() < density);
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || t - last < interval) return;
      last = t;
      // Fade previous glyphs toward transparent so the canvas sits on any background.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${size - 2}px "JetBrains Mono", monospace`;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      for (let i = 0; i < drops.length; i++) {
        if (!active[i]) continue;
        const y = (drops[i] ?? 0) * size;
        ctx.fillStyle = Math.random() > 0.975 ? headColor : color;
        ctx.fillText(GLYPHS.charAt((Math.random() * GLYPHS.length) | 0), i * size, y);
        if (y > canvas.clientHeight && Math.random() > 0.975) {
          drops[i] = 0;
          active[i] = Math.random() < density;
        } else {
          drops[i] = (drops[i] ?? 0) + 1;
        }
      }
    };

    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    io.observe(canvas);
    resize();
    window.addEventListener('resize', resize);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [size, interval, density, color, headColor, glow]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
