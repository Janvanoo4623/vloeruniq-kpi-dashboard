'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Snapshot, SyncMeta } from '@/lib/types';
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
import RevenueByWeekChart from './charts/RevenueByWeekChart';
import MarginTrendChart from './charts/MarginTrendChart';
import RunTimeTrendChart from './charts/RunTimeTrendChart';
import CountsByWeekChart from './charts/CountsByWeekChart';
import LeadSourceDonut from './charts/LeadSourceDonut';
import RegionList from './charts/RegionList';

export default function Dashboard({
  snapshot,
  meta,
}: {
  snapshot: Snapshot | null;
  meta: SyncMeta | null;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const series = useMemo(() => (snapshot ? weeklySeries(snapshot) : []), [snapshot]);

  async function refresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.dispatched) {
        // Background sync started in GitHub Actions; data isn't ready yet.
        setMessage(
          'Synchronisatie gestart op de achtergrond (~1–2 min). Ververs daarna de pagina.',
        );
      } else if (res.ok && data.ok) {
        router.refresh();
        setMessage('Data bijgewerkt.');
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

  const totals = snapshot?.revenue.totals;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Vloeruniq KPI Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Laatste {snapshot?.lookbackDays ?? 90} dagen · Teamleader
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-neutral-400">Laatst bijgewerkt</p>
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

      {message && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 shadow-sm">
          {message}
        </div>
      )}
      {refreshing && (
        <p className="mt-2 text-xs text-neutral-500">
          De synchronisatie haalt data op uit Teamleader en kan enkele minuten duren…
        </p>
      )}

      {!snapshot || !totals ? (
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
            />
            <KpiCard
              label="Omzet open"
              value={formatEuro(totals.openRevenue)}
              sub={`${totals.openCount} offertes`}
              accent="sky"
            />
            <KpiCard
              label="Conversie"
              value={formatPercent(totals.conversionPct)}
              sub={`${totals.refusedCount} geweigerd`}
              accent="amber"
            />
            <KpiCard
              label="Gem. omzet / deal"
              value={formatEuro(totals.avgRevenuePerDeal)}
              accent="neutral"
            />
            <KpiCard
              label="Totale marge"
              value={formatEuro(totals.totalMargin)}
              sub={`${formatPercent(totals.avgMarginPct)} gemiddeld`}
              accent="violet"
            />
            <KpiCard label="M² verkocht" value={formatNumber(totals.m2Sold)} accent="emerald" />
            <KpiCard
              label="Gem. doorlooptijd"
              value={formatDays(snapshot.runTime.totals.avgRunTimeDays)}
              accent="cyan"
            />
            <KpiCard
              label="Deals gevolgd"
              value={formatNumber(snapshot.runTime.totals.dealsTracked)}
              accent="neutral"
            />
            <KpiCard
              label="Gefactureerd"
              value={formatEuro(snapshot.invoicing.invoicedExcl)}
              sub={`${snapshot.invoicing.invoiceCount} facturen`}
              accent="sky"
            />
            <KpiCard
              label="Betaald"
              value={formatEuro(snapshot.invoicing.paidExcl)}
              sub={`${snapshot.invoicing.paidCount} betaald`}
              accent="emerald"
            />
            <KpiCard
              label="Openstaand"
              value={formatEuro(snapshot.invoicing.outstandingIncl)}
              sub={`${snapshot.invoicing.openCount} open · incl. btw`}
              accent="rose"
            />
            <KpiCard
              label="Betaald %"
              value={formatPercent(
                snapshot.invoicing.invoicedExcl > 0
                  ? Math.round((snapshot.invoicing.paidExcl / snapshot.invoicing.invoicedExcl) * 1000) / 10
                  : null,
              )}
              sub="van gefactureerd"
              accent="emerald"
            />
          </div>

          {/* Charts */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard
              title="Omzet per week"
              subtitle="Geaccepteerd vs. open (ex. btw)"
              className="lg:col-span-2"
            >
              <RevenueByWeekChart data={series} />
            </ChartCard>
            <ChartCard title="Omzet per leadbron" subtitle="Geaccepteerde offertes">
              {snapshot.leadSources.length > 0 ? (
                <LeadSourceDonut data={snapshot.leadSources} />
              ) : (
                <EmptyChart />
              )}
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
              <RegionList data={snapshot.regions} />
            </ChartCard>
          </div>

          {/* Combined tables: Offertes / Weekoverzicht switch */}
          <div className="mt-4">
            <DataTables snapshot={snapshot} />
          </div>

          <footer className="mt-8 pb-4 text-center text-xs text-neutral-400">
            Snapshot gegenereerd op {formatDateTime(snapshot.generatedAt)}
            {meta?.counts ? ` · ${meta.counts.quotations} offertes · ${meta.counts.runTime} deals` : ''}
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
        Er is nog geen snapshot. Draai lokaal{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">npm run sync</code>{' '}
        of klik op vernieuwen om data uit Teamleader op te halen.
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
    <div className="flex h-[200px] items-center justify-center text-sm text-neutral-400">
      Geen data
    </div>
  );
}
