'use client';

import { Ban, Pencil, TrendingDown, TrendingUp } from 'lucide-react';
import type { ExceptionsOverview } from '@/lib/exceptions';
import { formatEuro, formatPercent, formatProduct } from '@/lib/format';
import { STATUS_LABEL, STATUS_STYLE } from '@/components/QuotationModal';
import { Badge, Empty, Panel, SectionLabel, cn } from '@/components/ui';
import KpiCard from '@/components/KpiCard';

/**
 * Elke handmatige ingreep op één plek, mét het effect dat hij op de marge heeft.
 * Zonder dit overzicht is een correctie onzichtbaar zodra de modal dicht is,
 * terwijl hij wél in elke KPI doorwerkt.
 */
export default function UitzonderingenView({ data }: { data: ExceptionsOverview }) {
  const { corrections, exclusions, totalEffect } = data;
  const noLaborCount = corrections.filter((c) => c.noLabor).length;
  const priceCount = corrections.filter((c) => c.prices.length > 0).length;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Wat er handmatig is bijgesteld</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Gecorrigeerde offertes"
            value={String(corrections.length)}
            sub={`${priceCount}× prijs · ${noLaborCount}× los verkocht`}
            accent="accent"
          />
          <KpiCard
            label="Effect op de marge"
            value={formatEuro(totalEffect)}
            sub="verschil t.o.v. zonder correcties"
            accent={totalEffect >= 0 ? 'good' : 'crit'}
          />
          <KpiCard
            label="Uitgesloten offertes"
            value={String(exclusions.length)}
            sub="tellen nergens in mee"
            accent={exclusions.length > 0 ? 'warn' : 'neutral'}
          />
          <KpiCard
            label="Totaal ingrepen"
            value={String(corrections.length + exclusions.length)}
            sub="hoe minder, hoe beter de bron klopt"
            accent="neutral"
            higherIsBetter={false}
          />
        </div>
      </section>

      <Panel
        title="Correcties per offerte"
        subtitle="Werken direct en met terugwerkende kracht — een re-sync overschrijft ze niet"
        bodyClassName="p-0"
      >
        {corrections.length === 0 ? (
          <Empty>Nog geen correcties. Die zet je in een offerte via het potloodje.</Empty>
        ) : (
          <ul className="divide-y divide-hair">
            {corrections.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">
                        {c.customerName || c.name || 'Offerte'}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset',
                          STATUS_STYLE[c.status],
                        )}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                      <span className="text-[11.5px] text-ink-faint">{c.date}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.noLabor && (
                        <Badge tone="accent">
                          <Pencil size={9} strokeWidth={2.6} /> los verkocht — geen arbeid
                        </Badge>
                      )}
                      {c.prices.map((p) => (
                        <Badge key={p.code} tone="oak">
                          <Pencil size={9} strokeWidth={2.6} />
                          {formatProduct(p.code)}{' '}
                          {p.basePrice != null && (
                            <span className="opacity-70">{formatEuro(p.basePrice, true)} →</span>
                          )}
                          <strong>{formatEuro(p.price, true)}</strong>/m²
                        </Badge>
                      ))}
                    </div>

                    {c.note && <p className="mt-2 text-[12px] italic text-ink-mute">“{c.note}”</p>}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[10.5px] uppercase tracking-wide text-ink-faint">
                      Effect op de marge
                    </p>
                    <p
                      className={cn(
                        'flex items-center justify-end gap-1 text-[15px] font-bold tabular-nums',
                        (c.effect ?? 0) >= 0 ? 'text-good' : 'text-crit',
                      )}
                    >
                      {(c.effect ?? 0) >= 0 ? (
                        <TrendingUp size={13} strokeWidth={2.6} />
                      ) : (
                        <TrendingDown size={13} strokeWidth={2.6} />
                      )}
                      {formatEuro(c.effect)}
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      {formatEuro(c.marginWithout)} → {formatEuro(c.margin)} (
                      {formatPercent(c.marginPct)})
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Uitgesloten offertes"
        subtitle="Volledig buiten alle cijfers gehouden — bijvoorbeeld een testofferte of een dubbeling"
        bodyClassName="p-0"
      >
        {exclusions.length === 0 ? (
          <Empty>Geen offertes uitgesloten.</Empty>
        ) : (
          <ul className="divide-y divide-hair">
            {exclusions.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <Ban size={13} strokeWidth={2.2} className="shrink-0 text-warn" />
                    {e.quotation?.customerName || e.quotation?.name || e.id}
                  </p>
                  {e.reason && <p className="mt-0.5 pl-5 text-[12px] text-ink-mute">{e.reason}</p>}
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
                  {e.quotation ? formatEuro(e.quotation.revenueExVat) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
