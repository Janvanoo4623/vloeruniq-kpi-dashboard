'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, Tag } from 'lucide-react';
import type { ReviewItem } from '@/lib/review';
import type { MissingPrice, UnmatchedQuotation } from '@/lib/missing-prices';
import { formatEuro, formatNumber, formatProduct } from '@/lib/format';
import { STATUS_LABEL, STATUS_STYLE } from '@/components/QuotationModal';
import { Badge, Button, Empty, Panel, cn } from '@/components/ui';

/**
 * De werklijst. Twee ontwerpregels, allebei uit gebruikersfeedback:
 *
 * 1. Elke regel moet af kunnen. Er zat alleen een knop op "dit is fout" ("los
 *    verkocht"); klopte het wél, dan bleef de regel staan en werd de lijst nooit
 *    korter. Nu kan alles afgevinkt worden, en de kop telt wat er nog open is.
 * 2. De uitleg staat één keer per groep, niet onder elke rij. Dezelfde zin twintig
 *    keer herhaald leest als ruis en verbergt juist het verschil tussen de rijen.
 */
export default function ControleView({
  review,
  missing,
  unmatched,
}: {
  review: ReviewItem[];
  missing: MissingPrice[];
  unmatched: UnmatchedQuotation[];
}) {
  const open = review.filter((r) => !r.resolved && !r.reviewed);
  const afgehandeld = review.length - open.length;
  const losVerkocht = open.filter((r) => r.hint === 'likely-loose');
  const waarschijnlijkGoed = open.filter((r) => r.hint !== 'likely-loose');
  const laborAtStake = losVerkocht.reduce((s, r) => s + r.laborAtStake, 0);

  return (
    <div className="space-y-6">
      {/* Wat er van je verwacht wordt — bovenaan, in gewone taal. */}
      <div className="rounded-2xl border border-accent-line bg-accent-soft px-5 py-4">
        <h2 className="text-[14px] font-bold text-accent">Wat wordt hier van je gevraagd?</h2>
        <p className="mt-1.5 max-w-[86ch] text-[13px] leading-relaxed text-accent/90">
          Bij deze offertes staat in de tekst niet of het leggen erbij zat. De app rekent nu
          voorzichtigheidshalve arbeid (€17/m²). Per offerte hoef je één ding te beslissen:{' '}
          <strong>klopt dat, of is de vloer los verkocht?</strong>{' '}Beide knoppen halen de regel van
          de lijst — &ldquo;los verkocht&rdquo; past ook de marge aan, &ldquo;klopt zo&rdquo; laat
          de cijfers staan.
        </p>
        <p className="mt-2.5 text-[12.5px] font-medium text-accent">
          {open.length === 0 ? (
            <>Alles nagekeken — er staat niets meer open.</>
          ) : (
            <>
              Nog {open.length} te beoordelen, waarvan {losVerkocht.length} waarschijnlijk fout (
              {formatEuro(laborAtStake)} aan arbeid). {afgehandeld} al gedaan.
            </>
          )}
        </p>
      </div>

      {losVerkocht.length > 0 && (
        <ReviewGroup
          title="Waarschijnlijk los verkocht — hier valt iets te winnen"
          subtitle="Deze offertes rekenen arbeid, maar de prijs per m² ligt onder €35. Dat is het niveau waarop leggen aantoonbaar niet inbegrepen was (gemeten over 19 offertes die het expliciet uitsluiten: €21–35, mediaan €27). Mét leggen is de mediaan €51."
          items={losVerkocht}
          tone="warn"
        />
      )}

      {waarschijnlijkGoed.length > 0 && (
        <ReviewGroup
          title="Waarschijnlijk correct — even bevestigen"
          subtitle="Hier wijst niets op een losse verkoop. Bij gelijmde vloeren is dat vrijwel zeker: egaliseren en lijmen doet een klant niet zelf, en van 512 gemeten regels is er nooit een gelijmde vloer zonder legservice verkocht."
          items={waarschijnlijkGoed}
          tone="neutral"
        />
      )}

      {afgehandeld > 0 && (
        <ReviewGroup
          title="Afgehandeld"
          subtitle="Al beoordeeld. Terugdraaien kan altijd."
          items={review.filter((r) => r.resolved || r.reviewed)}
          tone="done"
          collapsed
        />
      )}

      {review.length === 0 && (
        <Panel title="Legstatus" subtitle="Zegt de offerte wat er inbegrepen is?">
          <Empty>Niets te controleren — elke vloerregel zegt wat er inbegrepen is.</Empty>
        </Panel>
      )}

      <Panel
        title="Vloeren zonder inkoopprijs"
        subtitle="Zonder inkoopprijs valt er geen marge te berekenen — deze omzet telt nu nergens in mee"
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
            <table className="w-full min-w-[620px] text-[13px]">
              <thead>
                <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 text-left font-semibold">Vloer</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Offertes</th>
                  <th className="px-5 py-2.5 text-right font-semibold">m²</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Omzet zonder marge</th>
                  <th className="px-5 py-2.5 text-left font-semibold">Wat te doen</th>
                </tr>
              </thead>
              <tbody>
                {missing.slice(0, 30).map((m) => (
                  <tr key={m.code} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-sunk px-1.5 py-0.5 text-[12px] font-medium text-ink-soft">
                        <Tag size={11} strokeWidth={2} className="text-ink-faint" />
                        {formatProduct(m.code)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                      {m.quotationCount}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                      {formatNumber(m.m2)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                      {formatEuro(m.revenue)}
                    </td>
                    <td className="px-5 py-2.5 text-[11.5px] text-ink-faint">
                      {m.derived
                        ? 'Naam uit de offertetekst — voeg toe als product'
                        : 'Vul de inkoopprijs in'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {missing.length > 30 && (
              <p className="border-t border-hair px-5 py-3 text-[11.5px] text-ink-faint">
                30 van {missing.length} getoond, grootste omzet eerst.
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Offertes waarin we geen vloer herkennen"
        subtitle="Meestal een project dat per ruimte is uitgesplitst — de m² staan er wel, maar de regel noemt geen vloer"
        bodyClassName="p-0"
      >
        {unmatched.length === 0 ? (
          <Empty>In elke offerte met omzet is minstens één vloerregel herkend.</Empty>
        ) : (
          <>
            <p className="border-b border-hair px-5 py-3 text-[12px] leading-relaxed text-ink-mute">
              Deze m² tellen bewust <strong>niet</strong> mee. In dezelfde offertes staan regels als
              &ldquo;Verwijderen en afvoeren tapijt 370&rdquo; met net zo goed m², en een ruimere
              regel zou die meesleuren. Wil je er één meenemen, zet dan de inkoopprijs handmatig via
              het potloodje in de offerte.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="px-5 py-2.5 text-left font-semibold">Klant</th>
                    <th className="px-5 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-5 py-2.5 text-right font-semibold">m²</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Omzet</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.slice(0, 20).map((u) => (
                    <tr key={u.id} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-ink">
                          {u.customerName || u.name || 'Offerte'}
                        </span>
                        <span className="ml-2 text-[11.5px] text-ink-faint">{u.date}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset',
                            STATUS_STYLE[u.status],
                          )}
                        >
                          {STATUS_LABEL[u.status]}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                        {u.totalM2 > 0 ? formatNumber(u.totalM2) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                        {formatEuro(u.revenueExVat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmatched.length > 20 && (
              <p className="border-t border-hair px-5 py-3 text-[11.5px] text-ink-faint">
                20 van {unmatched.length} getoond, grootste omzet eerst.
              </p>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

// ── Groep ────────────────────────────────────────────────────────────────

function ReviewGroup({
  title,
  subtitle,
  items,
  tone,
  collapsed = false,
}: {
  title: string;
  subtitle: string;
  items: ReviewItem[];
  tone: 'warn' | 'neutral' | 'done';
  collapsed?: boolean;
}) {
  const [dicht, setDicht] = useState(collapsed);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {tone === 'warn' && <span className="h-2 w-2 shrink-0 rounded-full bg-warn" />}
          {title}
          <span className="text-[11.5px] font-medium text-ink-faint">{items.length}</span>
        </span>
      }
      subtitle={dicht ? undefined : subtitle}
      right={
        <button
          onClick={() => setDicht((v) => !v)}
          className="flex items-center gap-1 text-[11.5px] font-medium text-ink-mute transition hover:text-ink"
        >
          {dicht ? 'Tonen' : 'Verbergen'}
          <ChevronDown
            size={13}
            strokeWidth={2.2}
            className={cn('transition', !dicht && 'rotate-180')}
          />
        </button>
      }
      bodyClassName="p-0"
    >
      {!dicht && (
        <ul className="divide-y divide-hair">
          {items.map((item) => (
            <ReviewRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── Eén offerte ──────────────────────────────────────────────────────────

function ReviewRow({ item }: { item: ReviewItem }) {
  const [busy, setBusy] = useState<'loose' | 'ok' | 'undo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const afgehandeld = item.resolved || item.reviewed;

  async function post(body: Record<string, unknown>, which: 'loose' | 'ok' | 'undo') {
    setBusy(which);
    setError(null);
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId: item.id, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || 'Opslaan mislukt.');
        setBusy(null);
        return;
      }
      // Herladen zodat elk herrekend getal meebeweegt en de lijst korter wordt.
      window.location.reload();
    } catch {
      setError('Opslaan mislukt (netwerk).');
      setBusy(null);
    }
  }

  return (
    <li className={cn('px-5 py-3.5', afgehandeld && 'bg-sunk/30')}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
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
            {item.resolved && (
              <Badge tone="accent">
                <Check size={10} strokeWidth={3} /> los verkocht
              </Badge>
            )}
            {item.reviewed && !item.resolved && (
              <Badge tone="good">
                <Check size={10} strokeWidth={3} /> klopt zo
              </Badge>
            )}
          </div>

          <ul className="mt-1.5 space-y-1">
            {item.lines.map((l, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] leading-snug"
              >
                <span className="text-ink-soft">{l.desc || formatProduct(l.code)}</span>
                <span className="whitespace-nowrap tabular-nums text-ink-faint">
                  {formatNumber(l.m2)} m²
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap rounded px-1 py-0.5 text-[11px] font-semibold tabular-nums',
                    l.pricePerM2 != null && l.pricePerM2 > 0 && l.pricePerM2 <= 35
                      ? 'bg-warn-soft text-warn'
                      : 'bg-sunk text-ink-mute',
                  )}
                >
                  {formatEuro(l.pricePerM2, true)}/m²
                </span>
                {l.installMode === 'glued' && (
                  <span className="whitespace-nowrap rounded bg-accent-soft px-1 py-0.5 text-[11px] font-medium text-accent">
                    gelijmd
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-ink-faint">Arbeid</p>
            <p className="text-[15px] font-bold leading-tight tabular-nums text-ink">
              {formatEuro(item.laborAtStake)}
            </p>
          </div>

          {afgehandeld ? (
            <Button
              variant="ghost"
              disabled={busy != null}
              onClick={() =>
                item.resolved
                  ? post({ type: 'no-labor', noLabor: false }, 'undo')
                  : post({ type: 'reviewed', reviewed: false }, 'undo')
              }
            >
              {busy ? '…' : 'Terugdraaien'}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={busy != null}
                onClick={() =>
                  post(
                    {
                      type: 'no-labor',
                      noLabor: true,
                      note: 'Los verkocht — bevestigd via Controleren',
                    },
                    'loose',
                  )
                }
              >
                {busy === 'loose' ? '…' : 'Los verkocht'}
              </Button>
              <Button
                variant="primary"
                disabled={busy != null}
                onClick={() => post({ type: 'reviewed', reviewed: true }, 'ok')}
              >
                {busy === 'ok' ? '…' : 'Klopt zo'}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-crit">{error}</p>}
    </li>
  );
}
