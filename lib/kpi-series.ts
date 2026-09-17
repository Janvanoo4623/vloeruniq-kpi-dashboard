// Eén tijdreeks met álle KPI's per week of maand, voor de grafiek op Overzicht
// waar je zelf aanvinkt wat je wilt zien. Elke KPI heeft een eenheid; de
// grafiek zet euro's, aantallen, procenten en dagen elk op een eigen as.
import { buildTimeSeries, type Granularity } from './series';
import type { Snapshot } from './types';
import { getISOWeek } from './teamleader/dates';

/** Dagtotaal advertenties. cost/clicks/impressions/conversions zijn Google; meta* is Meta. */
export interface AdsDayPoint {
  date: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  metaCost: number;
  metaClicks: number;
  metaConversions: number;
}

export type KpiUnit = 'eur' | 'count' | 'pct' | 'days';

export interface KpiDef {
  key: string;
  label: string;
  unit: KpiUnit;
  color: string;
  /** Standaard aangevinkt bij het openen van Overzicht. */
  defaultOn?: boolean;
  /** Bij een percentage of gemiddelde is optellen zinloos; dan tonen we niets in de totaalregel. */
  additive: boolean;
  /** Alleen tonen als er data van dit platform is. */
  group?: 'google' | 'meta' | 'any';
}

// Kleuren uit de huispalet-lijn (theme.ts), in vaste volgorde: een KPI houdt
// zijn kleur ook als je een andere uitzet — kleur volgt de KPI, niet de rang.
export const KPI_DEFS: KpiDef[] = [
  { key: 'acceptedRevenue', label: 'Omzet geaccepteerd', unit: 'eur', color: '#0e6b63', defaultOn: true, additive: true },
  { key: 'openRevenue', label: 'Omzet open', unit: 'eur', color: '#b4762a', defaultOn: true, additive: true },
  { key: 'margin', label: 'Marge', unit: 'eur', color: '#2f7a4e', additive: true },
  { key: 'marginPct', label: 'Marge %', unit: 'pct', color: '#a8761b', additive: false },
  { key: 'm2', label: 'M² verkocht', unit: 'count', color: '#8a6f4e', additive: true },
  { key: 'acceptedCount', label: 'Offertes geaccepteerd', unit: 'count', color: '#4a8f9c', additive: true },
  { key: 'conversionPct', label: 'Conversie %', unit: 'pct', color: '#5d7a5a', additive: false },
  { key: 'avgRunTime', label: 'Doorlooptijd', unit: 'days', color: '#6b7f8e', additive: false },
  { key: 'avgDeal', label: 'Gem. dealgrootte', unit: 'eur', color: '#7a5c8a', additive: false },
  { key: 'adsCost', label: 'Google Ads-kosten', unit: 'eur', color: '#a93b2c', additive: true, group: 'google' },
  { key: 'adsClicks', label: 'Google klikken', unit: 'count', color: '#8e6b6b', additive: true, group: 'google' },
  { key: 'adsConversions', label: 'Google conversies', unit: 'count', color: '#3f7d6b', additive: true, group: 'google' },
  { key: 'adsCpc', label: 'Google CPC', unit: 'eur', color: '#9a7b3c', additive: false, group: 'google' },
  { key: 'metaCost', label: 'Meta Ads-kosten', unit: 'eur', color: '#5f6ea0', additive: true, group: 'meta' },
  { key: 'metaClicks', label: 'Meta klikken', unit: 'count', color: '#7d86b3', additive: true, group: 'meta' },
  { key: 'metaConversions', label: 'Meta conversies', unit: 'count', color: '#4b5a8c', additive: true, group: 'meta' },
  { key: 'marginAfterAds', label: 'Marge na marketing', unit: 'eur', color: '#1c1917', additive: true, group: 'any' },
];

export type KpiPoint = { key: string; label: string } & Record<string, number | string | null>;

const round2 = (v: number) => Math.round(v * 100) / 100;

export function buildKpiSeries(snapshot: Snapshot, ads: AdsDayPoint[], granularity: Granularity): KpiPoint[] {
  const base = buildTimeSeries(snapshot, granularity);
  const bucketOf = (d: string) => (granularity === 'month' ? d.substring(0, 7) : getISOWeek(d));

  const empty = () => ({ cost: 0, clicks: 0, conversions: 0, metaCost: 0, metaClicks: 0, metaConversions: 0 });
  const adsBy = new Map<string, ReturnType<typeof empty>>();
  for (const d of ads) {
    const k = bucketOf(d.date);
    const e = adsBy.get(k) ?? empty();
    e.cost += d.cost;
    e.clicks += d.clicks;
    e.conversions += d.conversions;
    e.metaCost += d.metaCost ?? 0;
    e.metaClicks += d.metaClicks ?? 0;
    e.metaConversions += d.metaConversions ?? 0;
    adsBy.set(k, e);
  }

  return base.map((p) => {
    const a = adsBy.get(p.key) ?? empty();
    return {
      key: p.key,
      label: p.label,
      acceptedRevenue: p.acceptedRevenue,
      openRevenue: p.openRevenue,
      margin: p.margin,
      marginPct: p.marginPct,
      m2: p.m2,
      acceptedCount: p.acceptedCount,
      conversionPct: p.conversionPct,
      avgRunTime: p.avgRunTime,
      avgDeal: p.acceptedCount > 0 ? round2(p.acceptedRevenue / p.acceptedCount) : null,
      adsCost: round2(a.cost),
      adsClicks: a.clicks,
      adsConversions: round2(a.conversions),
      adsCpc: a.clicks > 0 ? round2(a.cost / a.clicks) : null,
      metaCost: round2(a.metaCost),
      metaClicks: a.metaClicks,
      metaConversions: round2(a.metaConversions),
      marginAfterAds: round2(p.margin - a.cost - a.metaCost),
    };
  });
}
