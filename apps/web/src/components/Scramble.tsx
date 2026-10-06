import { useEffect, useRef, useState } from 'react';

const KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモ';
const DIGITS = '0123456789';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ScrambleProps {
  text: string;
  /** Time in ms until the last character locks in. */
  duration?: number;
  delay?: number;
  /** Show a blinking caret while decoding. */
  caret?: boolean;
  className?: string;
}

/** Decodes text left-to-right from random glyphs, Matrix-style. */
export function Scramble({ text, duration = 700, delay = 0, caret = false, className }: ScrambleProps) {
  const [out, setOut] = useState(() => (reduced() ? text : ''));
  const [done, setDone] = useState(reduced);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced()) { setOut(text); setDone(true); return; }
    setDone(false);
    const numeric = /^[\d.,%\s/]+$/.test(text);
    const pool = numeric ? DIGITS : KANA + DIGITS;
    let start = 0;

    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start - delay) / duration);
      if (p < 0) { raf.current = requestAnimationFrame(tick); return; }
      const locked = Math.floor(p * text.length);
      let s = text.slice(0, locked);
      for (let i = locked; i < text.length; i++) {
        const ch = text.charAt(i);
        s += /[\s.,/%]/.test(ch) ? ch : pool.charAt((Math.random() * pool.length) | 0);
      }
      setOut(s);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [text, duration, delay]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{out}</span>
      {caret && <span className={`caret ${done ? 'caret-off' : ''}`} aria-hidden="true" />}
    </span>
  );
}
