'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Snapshot, SyncMeta, RevenueTotals, AgingBucket, OverdueInvoice } from '@/lib/types';
import type { PipelineStats } from '@/lib/pipeline';
import type { PaymentStats } from '@/lib/payments';
import { weeklySeries, type WeeklyPoint } from '@/lib/series';
import type { PerM2Stats } from '@/lib/insights';
import type { CustomerAnalysis } from '@/lib/customers';
import type { PeriodData } from '@/lib/period-data';
import type { AdsDayPoint } from '@/lib/kpi-series';
import type { OpenStockPoint } from '@/lib/open-stock';
import { presetRange, type RangeState } from '@/components/DateRangePicker';
import { DEFAULT_PRESET } from '@/lib/default-range';

export interface Aging {
  buckets: AgingBucket[];
  overdue: OverdueInvoice[];
  totalOutstanding: number;
}

export interface Comparison {
  from: string;
  to: string;
  revenue: RevenueTotals;
  runTime: { avgRunTimeDays: number; dealsTracked: number };
  /** Omzet/kostprijs/marge per m² over de vergelijkingsperiode. */
  perM2?: PerM2Stats;
  /** Openstaande stapel aan het eind van die periode. */
  openAtEnd?: { count: number; value: number };
}

export interface DashboardData {
  /** Snapshot voor de gekozen periode. Null zolang er nog nooit gesynct is. */
  snap: Snapshot | null;
  meta: SyncMeta | null;
  /** Huidige stand — niet periode-gefilterd (openstaand, pijplijn, betaalgedrag). */
  aging: Aging;
  pipeline: PipelineStats;
  payments: PaymentStats;
  pricedCodes: Set<string>;
  /** Klantanalyses voor de gekozen periode (betaalgedrag blijft over alles). */
  customers: CustomerAnalysis;
  series: WeeklyPoint[];
  range: RangeState;
  comparison: Comparison | null;
  /** Altijd de even lange periode ervoor — voor de pijltjes op Overzicht. */
  previous: Comparison | null;
  /** Dagtotalen Google Ads in de periode (leeg zolang de tabel niet bestaat). */
  adsDaily: AdsDayPoint[];
  /** De openstaande stapel per week, voor Trends. */
  openStock: OpenStockPoint[];
  /** Stapel aan het eind van de gekozen periode, tegenhanger van previous.openAtEnd. */
  openAtEnd: { count: number; value: number };
  dataLoading: boolean;
  refreshing: boolean;
  /** Loopt op na elke geslaagde verversing; pagina's met eigen data halen dan opnieuw op. */
  refreshCount: number;
  message: string | null;
  setRange: (r: RangeState) => void;
  refresh: () => Promise<void>;
  dismissMessage: () => void;
}

const Ctx = createContext<DashboardData | null>(null);

export function useDashboard(): DashboardData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDashboard moet binnen <DashboardProvider> gebruikt worden');
  return v;
}

const initialRange = (): RangeState => {
  // Zelfde bron als de server-render in app/(dashboard)/layout.tsx, anders zegt
  // de kop iets anders dan de grafiek eronder toont.
  const r = presetRange(DEFAULT_PRESET);
  return { preset: DEFAULT_PRESET, from: r.from, to: r.to, compare: 'none' };
};

/**
 * Houdt de periode-afhankelijke data vast voor élke pagina in de schil. Staat in
 * de layout, dus wisselen van pagina behoudt de gekozen periode en kost geen
 * nieuwe fetch. De zware berekeningen blijven server-side; dit is alleen de
 * client-cache eromheen.
 */
export default function DashboardProvider({
  period,
  meta,
  aging,
  pipeline,
  payments,
  pricedCodes,
  children,
}: {
  period: PeriodData;
  meta: SyncMeta | null;
  aging: Aging;
  pipeline: PipelineStats;
  payments: PaymentStats;
  pricedCodes: string[];
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(period.snapshot);
  const [customers, setCustomers] = useState<CustomerAnalysis>(period.customers);
  const [range, setRangeState] = useState<RangeState>(initialRange);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [previous, setPrevious] = useState<Comparison | null>(period.previous);
  const [adsDaily, setAdsDaily] = useState<AdsDayPoint[]>(period.adsDaily);
  const [openStock, setOpenStock] = useState<OpenStockPoint[]>(period.openStock);
  const [openAtEnd, setOpenAtEnd] = useState(period.openAtEnd);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const pricedSet = useMemo(() => new Set(pricedCodes), [pricedCodes]);
  const series = useMemo(() => (snap ? weeklySeries(snap) : []), [snap]);

  const setRange = useCallback(async (r: RangeState) => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/data?from=${r.from}&to=${r.to}&compare=${r.compare}`);
      const data = await res.json();
      if (res.ok && data.snapshot) {
        setSnap(data.snapshot);
        setComparison(data.comparison ?? null);
        setPrevious(data.previous ?? null);
        setAdsDaily(data.adsDaily ?? []);
        setOpenStock(data.openStock ?? []);
        if (data.openAtEnd) setOpenAtEnd(data.openAtEnd);
        if (data.customers) setCustomers(data.customers);
        setRangeState(r);
      } else {
        setMessage(data.error || 'Data laden mislukt.');
      }
    } catch {
      setMessage('Data laden mislukt (netwerk).');
    } finally {
      setDataLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.dispatched) {
        setMessage('Synchronisatie gestart op de achtergrond (~1–2 min). Ververs daarna de pagina.');
      } else if (res.ok && data.ok) {
        setMessage(data.ads && data.ads.ok === false && !data.ads.skipped ? `Data bijgewerkt. Google Ads niet: ${data.ads.error}` : 'Data bijgewerkt.');
        await setRange(range);
        setRefreshCount((n) => n + 1);
      } else if (res.status === 409) {
        setMessage('Er loopt al een synchronisatie.');
      } else {
        setMessage(data.error || 'Synchronisatie mislukt.');
      }
    } catch {
      setMessage('Synchronisatie mislukt (netwerk).');
    } finally {
      setRefreshing(false);
    }
  }, [range, setRange]);

  const value = useMemo<DashboardData>(
    () => ({
      snap,
      meta,
      aging,
      pipeline,
      payments,
      pricedCodes: pricedSet,
      customers,
      series,
      range,
      comparison,
      previous,
      adsDaily,
      openStock,
      openAtEnd,
      dataLoading,
      refreshing,
      refreshCount,
      message,
      setRange,
      refresh,
      dismissMessage: () => setMessage(null),
    }),
    [
      snap, meta, aging, pipeline, payments, pricedSet, customers, series,
      range, comparison, previous, adsDaily, openStock, openAtEnd, dataLoading, refreshing, refreshCount, message, setRange, refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
