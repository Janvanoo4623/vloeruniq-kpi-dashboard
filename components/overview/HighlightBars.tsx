'use client';

import { useState } from 'react';
import type { OverviewBars } from '@/lib/today';
import { formatEuro, formatNumber } from '@/lib/format';
import HighlightChart, { Pills, kortEuro, type HighlightSeries } from '@/components/page/HighlightChart';

/**
 * De hoofdgrafiek van Overzicht: twaalf weken of maanden, in dezelfde
 * staafstijl als elke pagina (components/page/HighlightChart). Los van de
 * periodekiezer, want het ritme over twaalf periodes is de vraag.
 */
export default function HighlightBars({ bars }: { bars: OverviewBars }) {
  const [gran, setGran] = useState<'weeks' | 'months'>('weeks');
  const punten = bars[gran];
  const per = gran === 'weeks' ? 'week' : 'maand';
  const reeks = (key: 'revenue' | 'margin' | 'm2' | 'count', label: string, kop: string, fmt: (v: number) => string, axisFmt?: (v: number) => string): HighlightSeries => {
    const vol = punten.filter((p) => !p.current);
    const gem = vol.length > 0 ? vol.reduce((t, p) => t + p[key], 0) / vol.length : null;
    return {
      key,
      label,
      title: `${kop} · laatste 12 ${gran === 'weeks' ? 'weken' : 'maanden'}`,
      fmt,
      axisFmt,
      sub: gem != null ? `gemiddeld ${fmt(Math.round(gem))} per ${per}` : undefined,
      points: punten.map((p) => ({ label: p.label, value: p[key], current: p.current })),
    };
  };
  return (
    <HighlightChart
      // Bij wisselen van week naar maand opnieuw beginnen, met dezelfde reeks.
      key={gran}
      series={[
        reeks('revenue', 'Omzet', 'Omzet geaccepteerd', (v) => formatEuro(v), kortEuro),
        reeks('margin', 'Marge', 'Marge', (v) => formatEuro(v), kortEuro),
        reeks('m2', 'M²', 'Verkochte m²', (v) => `${formatNumber(v)} m²`),
        reeks('count', 'Offertes', 'Gewonnen offertes', (v) => formatNumber(v)),
      ]}
      extra={
        <Pills
          value={gran}
          onChange={setGran}
          options={[
            { key: 'weeks', label: 'Week' },
            { key: 'months', label: 'Maand' },
          ]}
        />
      }
      footnote={`De lopende ${per} staat lichter: die is nog niet af`}
    />
  );
}
