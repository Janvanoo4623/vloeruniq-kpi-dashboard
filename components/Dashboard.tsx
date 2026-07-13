'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Snapshot, SyncMeta, RevenueTotals, AgingBucket, OverdueInvoice } from '@/lib/types';
import { weeklySeries } from '@/lib/series';
import {
  formatDateTime,
  formatDays,
  formatEuro,
  formatNumber,
  formatPercent,
  timeAgo,
} from '@/lib/format';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import DataTables from './DataTables';
import DateRangePicker, { presetRange, type RangeState } from './DateRangePicker';
import RevenueByWeekChart from './charts/RevenueByWeekChart';
import MarginTrendChart from './charts/MarginTrendChart';
import RunTimeTrendChart from './charts/RunTimeTrendChart';
import CountsByWeekChart from './charts/CountsByWeekChart';
import LeadSourceDonut from './charts/LeadSourceDonut';
import RegionList from './charts/RegionList';
import LeadSourceTable from './LeadSourceTable';
import CashflowCard from './CashflowCard';
import TrendsView from './TrendsView';

interface Aging {
  buckets: AgingBucket[];
  overdue: OverdueInvoice[];
  totalOutstanding: number;
}

interface Comparison {
  from: string;
  to: string;
  revenue: RevenueTotals;
  runTime: { avgRunTimeDays: number; dealsTracked: number };
}

const initialRange = (): RangeState => {
  const r = presetRange('90');
  return { preset: '90', from: r.from, to: r.to, compare: 'none' };
};

function deltaPct(cur: number, prev: number | undefined | null): number | null {
  if (prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export default function Dashboard({
  snapshot,
  meta,
  aging,
  pricedCodes,
}: {
  snapshot: Snapshot | null;
  meta: SyncMeta | null;
  aging: Aging;
  pricedCodes?: string[];
}) {
  const pricedSet = useMemo(() => new Set(pricedCodes ?? []), [pricedCodes]);
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(snapshot);
  const [range, setRange] = useState<RangeState>(initialRange);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<'overzicht' | 'trends'>('overzicht');

  const series = useMemo(() => (snap ? weeklySeries(snap) : []), [snap]);

  async function fetchData(r: RangeState) {
    setDataLoading(true);
    try {
      const res = await fetch(
        `/api/data?from=${r.from}&to=${r.to}&compare=${r.compare}`,
      );
      const data = await res.json();
      if (res.ok && data.snapshot) {
        setSnap(data.snapshot);
        setComparison(data.comparison ?? null);
        setRange(r);
      } else {
        setMessage(data.error || 'Data laden mislukt.');
      }
    } catch {
      setMessage('Data laden mislukt (netwerk).');
    } finally {
      setDataLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.dispatched) {
        setMessage('Synchronisatie gestart op de achtergrond (~1–2 min). Ververs daarna de pagina.');
      } else if (res.ok && data.ok) {
        setMessage('Data bijgewerkt.');
        await fetchData(range);
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
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const totals = snap?.revenue.totals;
  const cmp = comparison?.revenue;
  const deltaLabel = range.compare === 'year' ? 'vs vorig jaar' : 'vs vorige';
  const showDeltas = comparison != null;
  const marginPerM2 = totals && totals.m2Sold > 0 ? totals.totalMargin / totals.m2Sold : null;
  const prevMarginPerM2 = cmp && cmp.m2Sold > 0 ? cmp.totalMargin / cmp.m2Sold : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Vloeruniq KPI Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {range.from} t/m {range.to} · Teamleader
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-neutral-400">Laatst gesynchroniseerd</p>
            <p className="text-xs font-medium text-neutral-600" title={formatDateTime(meta?.lastSyncAt)}>
              {timeAgo(meta?.lastSyncAt)}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
          >
            <span className={refreshing ? 'animate-spin' : ''}>↻</span>
            {refreshing ? 'Bezig…' : 'Vernieuwen'}
          </button>
          <Link
            href="/instellingen"
            title="Instellingen"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:text-neutral-900"
          >
            ⚙
          </Link>
          <button
            onClick={logout}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:text-neutral-900"
          >
            Uitloggen
          </button>
        </div>
      </header>

      {/* Date selector + view toggle */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={fetchData} loading={dataLoading} />
        <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
          {(['overzicht', 'trends'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                view === v ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {v === 'overzicht' ? 'Overzicht' : 'Trends'}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 shadow-sm">
          {message}
        </div>
      )}

      {!snap || !totals ? (
        <EmptyState onRefresh={refresh} refreshing={refreshing} meta={meta} />
      ) : (
        <>
          {/* KPI cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KpiCard
              label="Omzet geaccepteerd"
              value={formatEuro(totals.acceptedRevenue)}
              sub={`${totals.acceptedCount} offertes`}
              accent="emerald"
              deltaPct={showDeltas ? deltaPct(totals.acceptedRevenue, cmp?.acceptedRevenue) : null}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              label="Omzet open"
              value={formatEuro(totals.openRevenue)}
              sub={`${totals.openCount} offertes`}
              accent="sky"
              deltaPct={showDeltas ? deltaPct(totals.openRevenue, cmp?.openRevenue) : null}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              label="Marge / m²"
              value={formatEuro(marginPerM2, true)}
              sub="per verkochte m²"
              accent="amber"
              deltaPct={showDeltas ? deltaPct(marginPerM2 ?? 0, prevMarginPerM2) : null}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              label="Gem. omzet / deal"
              value={formatEuro(totals.avgRevenuePerDeal)}
              accent="neutral"
              deltaPct={showDeltas ? deltaPct(totals.avgRevenuePerDeal, cmp?.avgRevenuePerDeal) : null}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              label="Totale marge"
              value={formatEuro(totals.totalMargin)}
              sub={`${formatPercent(totals.avgMarginPct)} gemiddeld`}
              accent="violet"
              deltaPct={showDeltas ? deltaPct(totals.totalMargin, cmp?.totalMargin) : null}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              label="M² verkocht"
              value={formatNumber(totals.m2Sold)}
              accent="emerald"
              deltaPct={showDeltas ? deltaPct(totals.m2Sold, cmp?.m2Sold) : null}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              label="Gem. doorlooptijd"
              value={formatDays(snap.runTime.totals.avgRunTimeDays)}
              accent="cyan"
              deltaPct={
                showDeltas
                  ? deltaPct(snap.runTime.totals.avgRunTimeDays, comparison?.runTime.avgRunTimeDays)
                  : null
              }
              deltaLabel={deltaLabel}
              higherIsBetter={false}
            />
            <KpiCard
              label="Deals gevolgd"
              value={formatNumber(snap.runTime.totals.dealsTracked)}
              accent="neutral"
              deltaPct={
                showDeltas
                  ? deltaPct(snap.runTime.totals.dealsTracked, comparison?.runTime.dealsTracked)
                  : null
              }
              deltaLabel={deltaLabel}
            />
            <KpiCard
              label="Gefactureerd"
              value={formatEuro(snap.invoicing.invoicedExcl)}
              sub={`${snap.invoicing.invoiceCount} facturen`}
              accent="sky"
            />
            <KpiCard
              label="Betaald"
              value={formatEuro(snap.invoicing.paidExcl)}
              sub={`${snap.invoicing.paidCount} betaald`}
              accent="emerald"
            />
            <KpiCard
              label="Openstaand"
              value={formatEuro(snap.invoicing.outstandingIncl)}
              sub={`${snap.invoicing.openCount} open · incl. btw`}
              accent="rose"
            />
            <KpiCard
              label="Betaald %"
              value={formatPercent(
                snap.invoicing.invoicedExcl > 0
                  ? Math.round((snap.invoicing.paidExcl / snap.invoicing.invoicedExcl) * 1000) / 10
                  : null,
              )}
              sub="van gefactureerd"
              accent="emerald"
            />
          </div>

          {view === 'trends' ? (
            <div className="mt-6">
              <TrendsView snapshot={snap} />
            </div>
          ) : (
          <>
          {/* Charts */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Omzet per week" subtitle="Geaccepteerd vs. open (ex. btw)" className="lg:col-span-2">
              <RevenueByWeekChart data={series} />
            </ChartCard>
            <ChartCard title="Omzet per leadbron" subtitle="Geaccepteerde offertes">
              {snap.leadSources.length > 0 ? <LeadSourceDonut data={snap.leadSources} /> : <EmptyChart />}
            </ChartCard>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Marge per week" subtitle="Marge in € (bars) en % (lijn)">
              <MarginTrendChart data={series} />
            </ChartCard>
            <ChartCard title="Doorlooptijd per week" subtitle="Gemiddelde looptijd in dagen">
              <RunTimeTrendChart data={series} />
            </ChartCard>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Offertes per week" subtitle="Aantal per status">
              <CountsByWeekChart data={series} />
            </ChartCard>
            <ChartCard title="Omzet per regio" subtitle="Top plaatsen (geaccepteerd)">
              <RegionList data={snap.regions} />
            </ChartCard>
          </div>

          <div className="mt-4">
            <ChartCard title="Leadbron-kwaliteit" subtitle="Omzet, dealgrootte, marge en doorlooptijd per bron">
              <LeadSourceTable data={snap.leadSources} />
            </ChartCard>
          </div>

          <div className="mt-4">
            <ChartCard title="Cashflow — openstaand naar ouderdom" subtitle="Onbetaalde facturen t.o.v. de vervaldatum (huidige stand)">
              <CashflowCard
                buckets={aging.buckets}
                overdue={aging.overdue}
                totalOutstanding={aging.totalOutstanding}
                pricedCodes={pricedSet}
              />
            </ChartCard>
          </div>

          {/* Combined tables */}
          <div className="mt-4">
            <DataTables snapshot={snap} pricedCodes={pricedSet} />
          </div>
          </>
          )}

          <footer className="mt-8 pb-4 text-center text-xs text-neutral-400">
            Snapshot {formatDateTime(snap.generatedAt)}
            {meta?.counts ? ` · ${meta.counts.quotations} offertes · ${meta.counts.runTime} deals gesynct` : ''}
          </footer>
        </>
      )}
    </div>
  );
}

function EmptyState({
  onRefresh,
  refreshing,
  meta,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  meta: SyncMeta | null;
}) {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center shadow-sm">
      <h2 className="text-lg font-medium text-neutral-800">Nog geen data</h2>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        Er is nog geen snapshot. Klik op vernieuwen om data uit Teamleader op te halen.
      </p>
      {meta?.status === 'error' && meta.error && (
        <p className="mt-3 max-w-md text-sm text-rose-600">Laatste fout: {meta.error}</p>
      )}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
      >
        <span className={refreshing ? 'animate-spin' : ''}>↻</span>
        {refreshing ? 'Bezig…' : 'Nu synchroniseren'}
      </button>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-neutral-400">Geen data</div>
  );
}
