'use client';

import { useMemo, useState } from 'react';
import type { Snapshot } from '@/lib/types';
import { computeMissingPrices } from '@/lib/missing-prices';
import QuotationsTable from './QuotationsTable';
import WeekOverviewTable from './WeekOverviewTable';
import ProductsTable from './ProductsTable';
import AttentionTable from './AttentionTable';

const TABS = [
  { key: 'offertes' as const, label: 'Offertes' },
  { key: 'producten' as const, label: 'Producten' },
  { key: 'aandacht' as const, label: 'Aandachtspunten' },
  { key: 'week' as const, label: 'Weekoverzicht' },
];

type TabKey = (typeof TABS)[number]['key'];

const SUBTITLES: Record<TabKey, string> = {
  offertes: 'Alle offertes in de periode — klik een rij voor details',
  producten: 'Omzet & marge per vloerproduct',
  aandacht: 'Laagste marges en offertes met onvolledige prijsdekking',
  week: "KPI's per week — nieuwste eerst",
};

export default function DataTables({
  snapshot,
  pricedCodes,
}: {
  snapshot: Snapshot;
  pricedCodes?: Set<string>;
}) {
  const [tab, setTab] = useState<TabKey>('offertes');

  const missingCount = useMemo(
    () => computeMissingPrices(snapshot.quotations, pricedCodes).length,
    [snapshot.quotations, pricedCodes],
  );

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-neutral-200 p-0.5 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                tab === t.key
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t.label}
              {t.key === 'aandacht' && missingCount > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                    tab === t.key ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                  }`}
                  title={`${missingCount} product(en) zonder inkoopprijs`}
                >
                  {missingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">{SUBTITLES[tab]}</p>
      </div>

      {tab === 'offertes' && (
        <QuotationsTable rows={snapshot.quotations} pricedCodes={pricedCodes} />
      )}
      {tab === 'producten' && <ProductsTable rows={snapshot.topProducts} />}
      {tab === 'aandacht' && (
        <AttentionTable rows={snapshot.quotations} pricedCodes={pricedCodes} />
      )}
      {tab === 'week' && <WeekOverviewTable snapshot={snapshot} />}
    </section>
  );
}
