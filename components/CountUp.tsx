'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Een getal dat naar zijn waarde oploopt — alleen voor de grote hoofdgetallen.
 * Kort (0,7 s) en vertragend aan het eind, zodat je het eindgetal leest en
 * niet de animatie. Wisselt de waarde (andere periode), dan loopt hij vanaf de
 * vorige waarde, niet vanaf nul. Met "minder beweging" aan: direct het getal.
 */
export default function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const vorige = useRef(0);

  useEffect(() => {
    const van = vorige.current;
    vorige.current = value;
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || van === value) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const duur = 700;
    let frame = 0;
    const stap = (t: number) => {
      const k = Math.min(1, (t - start) / duur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(van + (value - van) * e);
      if (k < 1) frame = requestAnimationFrame(stap);
    };
    frame = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(shown)}</>;
}
