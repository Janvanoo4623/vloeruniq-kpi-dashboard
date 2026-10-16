'use client';

import { useState, type ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Sparkline from '@/components/charts/Sparkline';
import QuotationModal from '@/components/QuotationModal';
import type { QuotationRow } from '@/lib/types';
import { deltaTone } from '@/lib/signal';
import { Card, cn } from '@/components/ui';

/**
 * Verschil-pil die alleen kleurt als het verschil iets betekent (lib/signal.ts).
 * Daaronder grijs, met het getal er gewoon bij — weglaten zou ook misleiden.
 */
export function CalmDelta({
  pct,
  label,
  sample,
  higherIsBetter = true,
}: {
  pct: number | null;
  label?: string;
  sample?: number;
  higherIsBetter?: boolean;
}) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const tone = deltaTone(pct, { sample, higherIsBetter });
  const Icon = Math.abs(pct) < 0.05 ? Minus : pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset',
        tone === 'good' && 'bg-good-soft text-good ring-good/20',
        tone === 'crit' && 'bg-crit-soft text-crit ring-crit/20',
        tone === 'neutral' && 'bg-sunk text-ink-mute ring-ink-faint/15',
      )}
    >
      <Icon size={11} strokeWidth={2.6} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/** Tegel: label, getal, verschil, en een lijntje dat laat zien waar het heen gaat. */
export function Tile({
  label,
  value,
  sub,
  delta,
  spark,
  color,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: ReactNode;
  spark: number[];
  color: string;
}) {
  return (
    <Card className="flex flex-col justify-between overflow-hidden">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-medium text-ink-mute">{label}</p>
          {delta}
        </div>
        <p className="mt-1.5 text-[26px] font-bold leading-none tracking-tight tabular-nums text-ink">{value}</p>
        {sub && <p className="mt-1.5 text-[11.5px] text-ink-faint">{sub}</p>}
      </div>
      <Sparkline values={spark} color={color} height={40} className="mt-3" />
    </Card>
  );
}

/** Haalt één offerte op en opent hem in de vertrouwde modal. */
export function useQuotationOpener(pricedCodes?: Set<string>) {
  const [offerte, setOfferte] = useState<QuotationRow | null>(null);
  const [laden, setLaden] = useState<string | null>(null);
  async function open(id: string) {
    setLaden(id);
    try {
      const res = await fetch(`/api/quotation?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (res.ok && json.ok) setOfferte(json.quotation as QuotationRow);
    } finally {
      setLaden(null);
    }
  }
  const modal = offerte ? <QuotationModal q={offerte} onClose={() => setOfferte(null)} pricedCodes={pricedCodes} /> : null;
  return { open, laden, modal };
}

/** "**€ 12.000** gewonnen" → vet getal. Alleen voor de eigen briefingzinnen. */
export function Rich({ text }: { text: string }) {
  const delen = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {delen.map((d, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {d}
          </strong>
        ) : (
          <span key={i}>{d}</span>
        ),
      )}
    </>
  );
}
