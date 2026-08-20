'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, Info, Tag } from 'lucide-react';
import { supplyOnlyHint, type ReviewItem } from '@/lib/review';
import type { MissingPrice } from '@/lib/missing-prices';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import { STATUS_LABEL, STATUS_STYLE } from '@/components/QuotationModal';
import { Badge, Button, Empty, Panel, SectionLabel, cn } from '@/components/ui';
import KpiCard from '@/components/KpiCard';

/**
 * De werklijst. Twee soorten open vragen, elk met de actie ernaast in plaats van
 * een verwijzing naar "ergens in de instellingen".
 */
export default function ControleView({
  review,
  missing,
}: {
  review: ReviewItem[];
  missing: MissingPrice[];
}) {
  const open = review.filter((r) => !r.resolved);
  const laborAtStake = open.reduce((s, r) => s + r.laborAtStake, 0);
  const missingRevenue = missing.reduce((s, m) => s + m.revenue, 0);

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Wat er open staat</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard
            label="Legstatus onbekend"
            value={formatNumber(open.length)}
            sub={`${formatEuro(laborAtStake)} aan arbeid staat op het spel`}
            accent={open.length > 0 ? 'warn' : 'good'}
            higherIsBetter={false}
          />
          <KpiCard
            label="Vloeren zonder inkoopprijs"
            value={formatNumber(missing.length)}
            sub={`${formatEuro(missingRevenue)} omzet zonder marge`}
            accent={missing.length > 0 ? 'crit' : 'good'}
            higherIsBetter={false}
          />
          <KpiCard
            label="Al afgehandeld"
            value={formatNumber(review.length - open.length)}
            sub={`van ${formatNumber(review.length)} gemarkeerde offertes`}
            accent="good"
          />
        </div>
      </section>

      <Panel
        title="Zegt de offerte niets over leggen?"
        subtitle="Deze regels krijgen nu arbeid — de veiligste aanname. Klopt dat niet, zet 'm dan op los verkocht."
        bodyClassName="p-0"
      >
        {review.length === 0 ? (
          <Empty>Niets te controleren — elke vloerregel zegt wat er inbegrepen is.</Empty>
        ) : (
          <ul className="divide-y divide-hair">
            {review.map((item) => (
              <ReviewRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Vloeren zonder inkoopprijs"
        subtitle="Zonder inkoopprijs is er geen marge te berekenen — deze omzet telt nu nergens in mee"
        right={
          <Link
            href="/instellingen"
            className="flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
          >
            Prijzen beheren <ArrowRight size={12} strokeWidth={2.2} />
          </Link>
        }
        bodyClassName="p-0"
      >
        {missing.length === 0 ? (
          <Empty>Elke vloer die voorkomt heeft een inkoopprijs.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 text-left font-semibold">Vloer</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Offertes</th>
                  <th className="px-5 py-2.5 text-right font-semibold">m²</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Omzet zonder marge</th>
                </tr>
              </thead>
              <tbody>
                {missing.map((m) => (
                  <tr key={m.code} className="border-b border-hair last:border-0 hover:bg-sunk">
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-sunk px-1.5 py-0.5 text-[12px] font-medium text-ink-soft">
                        <Tag size={11} strokeWidth={2} className="text-ink-faint" />
                        {formatProduct(m.code)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{m.quotationCount}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{formatNumber(m.m2)}</td>
                    <td className="px-5 py-2.5 text-right font-medium tabular-nums text-ink">
                      {formatEuro(m.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(item.resolved);
  const [error, setError] = useState<string | null>(null);

  // Sterkste signaal van de regels wint: 'gelijmd' is harder dan een prijsniveau.
  const hints = item.lines.map(supplyOnlyHint);
  const hint = hints.includes('likely-installed')
    ? 'likely-installed'
    : hints.includes('likely-loose')
      ? 'likely-loose'
      : null;

  async function setNoLabor(noLabor: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationId: item.id,
          type: 'no-labor',
          noLabor,
          note: noLabor ? 'Los verkocht — bevestigd via Controleren' : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || 'Opslaan mislukt.');
        return;
      }
      setResolved(noLabor);
      // Herladen zodat elk herrekend getal (marge, KPI's, pijplijn) meebeweegt.
      window.location.reload();
    } catch {
      setError('Opslaan mislukt (netwerk).');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn('px-5 py-4', resolved && 'bg-sunk/40')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink">
              {item.customerName || item.name || 'Offerte'}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset',
                STATUS_STYLE[item.status],
              )}
            >
              {STATUS_LABEL[item.status]}
            </span>
            <span className="text-[11.5px] text-ink-faint">{item.date}</span>
            {resolved && (
              <Badge tone="good">
                <Check size={10} strokeWidth={3} /> los verkocht
              </Badge>
            )}
          </div>

          <ul className="mt-2 space-y-1.5">
            {item.lines.map((l, i) => (
              <li key={i} className="text-[12.5px] leading-snug text-ink-mute">
                <span className="text-ink-soft">{l.desc || formatProduct(l.code)}</span>
                <span className="ml-2 whitespace-nowrap tabular-nums text-ink-faint">
                  {formatNumber(l.m2)} m² · {formatEuro(l.pricePerM2, true)}/m²
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wide text-ink-faint">Arbeid in het geding</p>
            <p className="text-[15px] font-bold tabular-nums text-ink">{formatEuro(item.laborAtStake)}</p>
            <p className="text-[11px] text-ink-faint">
              marge nu {formatEuro(item.margin)} ({formatPercent(item.marginPct)})
            </p>
          </div>
          {resolved ? (
            <Button variant="ghost" disabled={busy} onClick={() => setNoLabor(false)}>
              Toch mét legservice
            </Button>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => setNoLabor(true)}>
              {busy ? '…' : 'Los verkocht — geen arbeid'}
            </Button>
          )}
        </div>
      </div>

      {!resolved && hint === 'likely-loose' && (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-warn">
          <AlertTriangle size={12} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          Onder €35/m² — dat is het niveau waarop leggen aantoonbaar niet inbegrepen was
          (gemeten mediaan €27). Waarschijnlijk los verkocht.
        </p>
      )}
      {!resolved && hint === 'likely-installed' && (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-accent">
          <Info size={12} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          Gelijmd werk — egaliseren en lijmen doet een klant niet zelf. Van 512 regels is er nooit
          een gelijmde vloer zonder legservice verkocht, dus arbeid klopt hier vrijwel zeker.
        </p>
      )}

      {error && <p className="mt-2 text-[12px] text-crit">{error}</p>}
    </li>
  );
}
