// Wanneer is een verschil het kleuren waard?
//
// Over dertig dagen met zeventien offertes is -27% voor een groot deel toeval.
// Elke pijl rood of groen maken laat het dashboard schreeuwen om ruis, en dan
// leert de lezer de kleur te negeren — ook op de dag dat het wél iets betekent.
// Dus: kleur alleen bij een groot verschil op genoeg waarnemingen. Daaronder
// blijft het getal staan, in grijs.
export type DeltaTone = 'good' | 'crit' | 'neutral';

export function deltaTone(
  pct: number | null | undefined,
  { sample, higherIsBetter = true, threshold = 15, minSample = 20 }: { sample?: number; higherIsBetter?: boolean; threshold?: number; minSample?: number } = {},
): DeltaTone {
  if (pct == null || !Number.isFinite(pct)) return 'neutral';
  if (Math.abs(pct) < threshold) return 'neutral';
  if (sample != null && sample < minSample) return 'neutral';
  const up = pct > 0;
  return up === higherIsBetter ? 'good' : 'crit';
}

export function deltaPct(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}
