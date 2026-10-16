'use client';

import { useState } from 'react';
import type { InvoicedMargin, InvoiceMarginReason } from '@/lib/invoiced-margin';
import type { QuotationRow } from '@/lib/types';
import { formatEuro, formatPercent } from '@/lib/format';
import { Badge, Empty, Panel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';
import QuotationModal from '@/components/QuotationModal';

const DEEL: { key: InvoiceMarginReason; label: string; bar: string }[] = [
  { key: 'ok', label: 'Marge bekend', bar: 'bg-accent' },
  // Oranje omdat je hier iets aan kunt doen: de inkoopprijs aanvullen.
  { key: 'geen-inkoopprijs', label: 'Offerte zonder inkoopprijs', bar: 'bg-warn' },
  { key: 'geen-offerte', label: 'Zonder offerte', bar: 'bg-ink-faint/40' },
];

const datum = (d: string) => {
  const [, m, dd] = d.split('-');
  return `${Number(dd)} ${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(m) - 1]}`;
};

/**
 * Marge op factuurdatum, naast de marge op de datum van akkoord.
 *
 * Jan vroeg of "marge afgelopen 30 dagen" over facturen of over offertes ging.
 * Het dashboard telt overal offertes; dit blok geeft het andere antwoord ernaast,
 * zodat je het kunt leggen naast wat de boekhouding over dezelfde maand zegt.
 * Hoe een factuur aan zijn marge komt staat in lib/invoiced-margin.ts.
 */
export default function InvoicedMarginPanel({
  data,
  quotationMargin,
  pricedCodes,
}: {
  data: InvoicedMargin;
  /** Marge op de offertes die in dezelfde periode zijn gewonnen. */
  quotationMargin: number;
  pricedCodes?: Set<string>;
}) {
  const { visible, props } = usePaged(data.rows);
  const [offerte, setOfferte] = useState<QuotationRow | null>(null);
  const [laden, setLaden] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function openOfferte(id: string) {
    setLaden(id);
    setFout(null);
    try {
      const res = await fetch(`/api/quotation?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) setFout(json.error || 'Offerte laden mislukt.');
      else setOfferte(json.quotation as QuotationRow);
    } catch {
      setFout('Offerte laden mislukt (netwerk).');
    } finally {
      setLaden(null);
    }
  }

  const titel = 'Marge op facturen';
  const subtitel = 'Dezelfde marge, maar geteld op de factuurdatum in plaats van de datum van akkoord — ex btw';

  if (!data.linked) {
    return (
      <Panel title={titel} subtitle={subtitel}>
        <Empty>Facturen zijn nog niet aan hun offerte gekoppeld (kolom invoices.deal_id ontbreekt nog of is nog leeg).</Empty>
      </Panel>
    );
  }

  const totaal = data.parts.ok.amount + data.parts['geen-inkoopprijs'].amount + data.parts['geen-offerte'].amount;
  const aandeel = (v: number) => (totaal > 0 ? Math.max(0, v / totaal) * 100 : 0);

  return (
    <Panel title={titel} subtitle={subtitel} bodyClassName="p-0">
      <div className="grid gap-6 px-5 pt-5 pb-4 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[12px] font-medium text-ink-mute">Marge op wat er gefactureerd is</p>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight tabular-nums text-ink">
            {formatEuro(data.margin)}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-mute">
            {data.marginPct != null ? `${formatPercent(data.marginPct)} van ` : 'over '}
            {formatEuro(data.parts.ok.amount)} gefactureerd met bekende marge
          </p>
        </div>
        <div className="rounded-xl bg-sunk px-4 py-3">
          <p className="text-[12px] font-medium text-ink-mute">Ter vergelijking</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-ink-soft">{formatEuro(quotationMargin)}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
            marge op de offertes die in deze periode zijn gewonnen — wat de rest van het dashboard toont.
            Het verschil is vooral tijd: werk dat eerder verkocht is wordt nu gefactureerd.
          </p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-[12px]">
          <span className="text-ink-mute">
            Gefactureerd in deze periode: <strong className="text-ink">{formatEuro(data.invoicedExcl)}</strong>
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-sunk">
          {DEEL.map((d) => (
            <span key={d.key} className={cn('block h-full', d.bar)} style={{ width: `${aandeel(data.parts[d.key].amount)}%` }} />
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
          {DEEL.map((d) => (
            <li key={d.key} className="flex items-center gap-1.5 text-ink-mute">
              <span className={cn('inline-block h-2 w-2 rounded-full', d.bar)} />
              {d.label}
              <span className="tabular-nums text-ink-soft">{formatEuro(data.parts[d.key].amount)}</span>
              <span className="text-ink-faint">· {data.parts[d.key].count}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Een factuur vindt zijn offerte via de deal in Teamleader en krijgt het deel van de offertemarge dat
          hoort bij wat hij factureert: een aanbetaling van 40% draagt 40% van de marge. Facturen zonder deal
          (losse verkoop) hebben geen inkoopprijzen en tellen daarom niet mee in het percentage.
          {data.notAccepted > 0 &&
            ` ${data.notAccepted === 1 ? 'Eén gefactureerde offerte staat' : `${data.notAccepted} gefactureerde offertes staan`} in Teamleader nog op verlopen — in de conversie ${data.notAccepted === 1 ? 'telt die' : 'tellen die'} als verloren.`}
        </p>
      </div>

      {data.rows.length === 0 ? (
        <Empty className="border-t border-hair">Geen facturen in deze periode.</Empty>
      ) : (
        <div className="overflow-x-auto border-t border-hair">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-2 text-left font-medium">Datum</th>
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">Gefactureerd</th>
                <th className="px-5 py-2 text-right font-medium">Marge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {visible.map((r) => {
                const klikbaar = r.quotationId != null;
                return (
                  <tr
                    key={r.id}
                    onClick={() => r.quotationId && openOfferte(r.quotationId)}
                    className={cn('hover:bg-sunk', klikbaar && 'cursor-pointer', laden === r.quotationId && 'opacity-60')}
                  >
                    <td className="whitespace-nowrap px-5 py-2 tabular-nums text-ink-mute">{datum(r.invoiceDate)}</td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[260px] items-center gap-1.5 truncate text-ink">
                        {r.customerName || '—'}
                        {klikbaar && <span className="text-ink-faint">›</span>}
                        {r.credit && <Badge>creditnota</Badge>}
                        {r.quotationStatus && r.quotationStatus !== 'accepted' && (
                          <Badge title="Er is gefactureerd, maar de offerte staat in Teamleader niet op geaccepteerd">
                            offerte verlopen
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatEuro(r.amount)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">
                      {r.margin != null ? (
                        <span className={r.margin < 0 ? 'text-crit' : 'text-ink'}>{formatEuro(r.margin)}</span>
                      ) : r.reason === 'geen-inkoopprijs' ? (
                        <Badge tone="warn">geen inkoopprijs</Badge>
                      ) : (
                        <span className="text-[12px] text-ink-faint">geen offerte</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination {...props} />
        </div>
      )}
      {fout && <p className="px-5 pb-4 text-[12px] text-crit">{fout}</p>}

      {offerte && <QuotationModal q={offerte} onClose={() => setOfferte(null)} pricedCodes={pricedCodes} />}
    </Panel>
  );
}
