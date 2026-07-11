'use client';

import { useState } from 'react';
import type { Snapshot } from '@/lib/types';
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

export default function DataTables({ snapshot }: { snapshot: Snapshot }) {
  const [tab, setTab] = useState<TabKey>('offertes');

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-neutral-200 p-0.5 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                tab === t.key
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">{SUBTITLES[tab]}</p>
      </div>

      {tab === 'offertes' && <QuotationsTable rows={snapshot.quotations} />}
      {tab === 'producten' && <ProductsTable rows={snapshot.topProducts} />}
      {tab === 'aandacht' && <AttentionTable rows={snapshot.quotations} />}
      {tab === 'week' && <WeekOverviewTable snapshot={snapshot} />}
    </section>
  );
}
