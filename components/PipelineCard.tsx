'use client';

import { useState } from 'react';
import type { PipelineStats } from '@/lib/pipeline';
import type { QuotationRow } from '@/lib/types';
import { formatEuro, formatPercent } from '@/lib/format';
import QuotationModal from './QuotationModal';

const TIER_COLORS = ['bg-accent', 'bg-warn', 'bg-crit'];

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

        <p className="mt-3 text-xs text-ink-faint">
          Winkans o.b.v. offertes ouder dan 60 dagen (oud genoeg om beslist te zijn); nog-open
          offertes daarbuiten tellen als verloren.
        </p>

        {/* Age split */}
        <div className="mt-4 space-y-2.5">
          <p className="text-xs font-medium text-ink-mute">Open offertes naar ouderdom</p>
          {pipeline.ageTiers.map((t, i) => (
            <div key={t.label} className="text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-ink-soft">{t.label}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  {formatEuro(t.value)} <span className="text-ink-faint">· {t.count}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunk">
                <span
                  className={`block h-full rounded-full ${TIER_COLORS[i] ?? 'bg-ink-faint'}`}
                  style={{ width: `${(t.value / maxTier) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Oldest open — chase list */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink-soft">Oudste open offertes</p>
        <div className="max-h-[260px] overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">Open</th>
                <th className="px-3 py-2 text-right font-medium">Waarde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {pipeline.oldestOpen.map((o) => (
                <tr
                  key={o.quotation.id}
                  onClick={() => setQuotation(o.quotation)}
                  className="cursor-pointer hover:bg-sunk"
                >
                  <td className="px-3 py-2">
                    <div className="flex max-w-[200px] items-center gap-1 truncate text-ink">
                      {o.quotation.customerName || '—'}
                      <span className="text-ink-faint">›</span>
                    </div>
                    <div className="max-w-[200px] truncate text-xs text-ink-faint">{o.quotation.name}</div>
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${
                      o.daysOpen > 60 ? 'text-crit' : o.daysOpen > 30 ? 'text-warn' : 'text-ink-soft'
                    }`}
                  >
                    {o.daysOpen}d
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatEuro(o.value)}</td>
                </tr>
              ))}
              {pipeline.oldestOpen.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-ink-faint">
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
    <div className={`rounded-lg px-3 py-2 ${accent ? 'bg-good-soft' : 'bg-sunk'}`}>
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${accent ? 'text-good' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-faint">{sub}</div>
    </div>
  );
}
