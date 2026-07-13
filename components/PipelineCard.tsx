'use client';

import { useState } from 'react';
import type { PipelineStats } from '@/lib/pipeline';
import type { QuotationRow } from '@/lib/types';
import { formatEuro, formatPercent } from '@/lib/format';
import QuotationModal from './QuotationModal';

const TIER_COLORS = ['bg-emerald-500', 'bg-amber-400', 'bg-rose-500'];

export default function PipelineCard({
  pipeline,
  pricedCodes,
}: {
  pipeline: PipelineStats;
  pricedCodes?: Set<string>;
}) {
  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const maxTier = Math.max(1, ...pipeline.ageTiers.map((t) => t.value));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        {/* Headline numbers */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Open pijplijn" value={formatEuro(pipeline.openValue)} sub={`${pipeline.openCount} offertes`} />
          <Stat
            label="Winkans"
            value={pipeline.winRate == null ? '—' : formatPercent(pipeline.winRate)}
            sub={pipeline.winRate == null ? 'te weinig historie' : `${pipeline.maturedAccepted}/${pipeline.maturedTotal} volgroeid`}
          />
          <Stat
            label="Verwachte omzet"
            value={pipeline.expectedValue == null ? '—' : formatEuro(pipeline.expectedValue)}
            sub="gewogen"
            accent
          />
        </div>

        <p className="mt-3 text-xs text-neutral-400">
          Winkans o.b.v. offertes ouder dan 60 dagen (oud genoeg om beslist te zijn); nog-open
          offertes daarbuiten tellen als verloren.
        </p>

        {/* Age split */}
        <div className="mt-4 space-y-2.5">
          <p className="text-xs font-medium text-neutral-500">Open offertes naar ouderdom</p>
          {pipeline.ageTiers.map((t, i) => (
            <div key={t.label} className="text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-neutral-700">{t.label}</span>
                <span className="shrink-0 tabular-nums text-neutral-600">
                  {formatEuro(t.value)} <span className="text-neutral-400">· {t.count}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <span
                  className={`block h-full rounded-full ${TIER_COLORS[i] ?? 'bg-neutral-400'}`}
                  style={{ width: `${(t.value / maxTier) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Oldest open — chase list */}
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Oudste open offertes</p>
        <div className="max-h-[260px] overflow-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">Open</th>
                <th className="px-3 py-2 text-right font-medium">Waarde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pipeline.oldestOpen.map((o) => (
                <tr
                  key={o.quotation.id}
                  onClick={() => setQuotation(o.quotation)}
                  className="cursor-pointer hover:bg-neutral-50"
                >
                  <td className="px-3 py-2">
                    <div className="flex max-w-[200px] items-center gap-1 truncate text-neutral-800">
                      {o.quotation.customerName || '—'}
                      <span className="text-neutral-300">›</span>
                    </div>
                    <div className="max-w-[200px] truncate text-xs text-neutral-400">{o.quotation.name}</div>
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${
                      o.daysOpen > 60 ? 'text-rose-600' : o.daysOpen > 30 ? 'text-amber-600' : 'text-neutral-600'
                    }`}
                  >
                    {o.daysOpen}d
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-700">{formatEuro(o.value)}</td>
                </tr>
              ))}
              {pipeline.oldestOpen.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-neutral-400">
                    Geen open offertes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {quotation && (
        <QuotationModal q={quotation} onClose={() => setQuotation(null)} pricedCodes={pricedCodes} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 ${accent ? 'bg-emerald-50' : 'bg-neutral-50'}`}>
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${accent ? 'text-emerald-700' : 'text-neutral-800'}`}>
        {value}
      </div>
      <div className="text-xs text-neutral-400">{sub}</div>
    </div>
  );
}
