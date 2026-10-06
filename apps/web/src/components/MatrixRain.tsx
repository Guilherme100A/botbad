import { useEffect, useRef } from 'react';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';

/** Low-key digital rain. Decorative only; respects reduced motion. */
export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const size = 16;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(canvas.clientWidth / size);
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 60) return;
      last = t;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.font = `${size - 2}px "JetBrains Mono", monospace`;
      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * size;
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.fillStyle = Math.random() > 0.975 ? '#d8ffe6' : '#00ff6a';
        ctx.fillText(ch, i * size, y);
        if (y > canvas.clientHeight && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="matrix-rain" aria-hidden="true" />;
}
