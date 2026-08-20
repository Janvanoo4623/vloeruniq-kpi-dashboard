'use client';

import { useState } from 'react';
import { Ban, ChevronDown, Tag } from 'lucide-react';
import type { ReviewItem } from '@/lib/review';
import type { MissingPrice, UnmatchedQuotation } from '@/lib/missing-prices';
import { formatEuro, formatNumber, formatProduct } from '@/lib/format';
import { STATUS_LABEL } from '@/components/QuotationModal';
import PriceInput from '@/components/PriceInput';
import { Badge, Button, Card, Empty, cn } from '@/components/ui';

type TabKey = 'los' | 'correct' | 'prijs' | 'geenvloer' | 'klaar';

/**
 * De werklijst, als losse werkbakjes in plaats van één lange pagina.
 *
 * Drie ontwerpregels, alle drie uit gebruikersfeedback:
 *  1. Elke regel moet af kunnen — er zat eerst alleen een knop op "dit is fout",
 *     dus de lijst werd nooit korter en je wist niet wanneer je klaar was.
 *  2. De uitleg staat één keer per bakje, niet onder elke rij.
 *  3. De actie hoort hier, niet elders. Zie je dat een vloer geen inkoopprijs
 *     heeft, dan vul je hem hier in — niet via een link naar Instellingen en
 *     daar terugzoeken welke het ook alweer was.
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
  const losVerkocht = open.filter((r) => r.hint === 'likely-loose');
  const correct = open.filter((r) => r.hint !== 'likely-loose');
  const klaar = review.filter((r) => r.resolved || r.reviewed);
  const geenVloerOpen = unmatched.filter((u) => !u.reviewed);

  // Open op het eerste bakje dat werk bevat, zodat je niet op een lege lijst landt.
  const eerste: TabKey =
    losVerkocht.length > 0
      ? 'los'
      : missing.length > 0
        ? 'prijs'
        : correct.length > 0
          ? 'correct'
          : geenVloerOpen.length > 0
            ? 'geenvloer'
            : 'klaar';
  const [tab, setTab] = useState<TabKey>(eerste);

  const tabs: { key: TabKey; label: string; count: number; urgent?: boolean }[] = [
    { key: 'los', label: 'Waarschijnlijk los verkocht', count: losVerkocht.length, urgent: true },
    { key: 'prijs', label: 'Zonder inkoopprijs', count: missing.length, urgent: true },
    { key: 'correct', label: 'Waarschijnlijk correct', count: correct.length },
    { key: 'geenvloer', label: 'Geen vloer herkend', count: geenVloerOpen.length },
    { key: 'klaar', label: 'Afgehandeld', count: klaar.length },
  ];

  const totaalOpen = losVerkocht.length + correct.length + missing.length + geenVloerOpen.length;
  const arbeidOpHetSpel = losVerkocht.reduce((s, r) => s + r.laborAtStake, 0);
  const omzetZonderMarge = missing.reduce((s, m) => s + m.revenue, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-accent-line bg-accent-soft px-5 py-3.5">
        <p className="text-[13px] leading-relaxed text-accent">
          {totaalOpen === 0 ? (
            <>Alles nagekeken — er staat niets meer open.</>
          ) : (
            <>
              <strong>{totaalOpen} punten open.</strong> {formatEuro(arbeidOpHetSpel)} aan arbeid
              staat mogelijk verkeerd geboekt, en {formatEuro(omzetZonderMarge)} omzet heeft geen
              marge omdat de inkoopprijs ontbreekt. Elk bakje hieronder werk je apart af.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const aan = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] transition',
                aan
                  ? 'border-line bg-surface font-semibold text-ink shadow-sm'
                  : 'border-transparent text-ink-mute hover:bg-sunk hover:text-ink',
              )}
            >
              {t.urgent && t.count > 0 && !aan && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
              )}
              {t.label}
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums',
                  aan ? 'bg-sunk text-ink-soft' : 'bg-sunk/70 text-ink-faint',
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'los' && (
        <Bakje
          uitleg="Deze offertes rekenen arbeid, maar de prijs per m² ligt onder €35. Dat is het niveau waarop leggen aantoonbaar niet inbegrepen was (gemeten over 19 offertes die het expliciet uitsluiten: €21–35, mediaan €27). Mét leggen is de mediaan €51."
          leeg="Niets dat op een losse verkoop wijst."
          items={losVerkocht}
        />
      )}
      {tab === 'correct' && (
        <Bakje
          uitleg="Hier wijst niets op een losse verkoop. Bij gelijmde vloeren is dat vrijwel zeker: egaliseren en lijmen doet een klant niet zelf, en van 512 gemeten regels is er nooit een gelijmde vloer zonder legservice verkocht. Even bevestigen is genoeg."
          leeg="Niets te bevestigen."
          items={correct}
        />
      )}
      {tab === 'klaar' && (
        <Bakje
          uitleg="Al beoordeeld. Terugdraaien kan altijd."
          leeg="Nog niets afgehandeld."
          items={klaar}
        />
      )}
      {tab === 'prijs' && <PrijzenBakje missing={missing} />}
      {tab === 'geenvloer' && <GeenVloerBakje items={unmatched} />}
    </div>
  );
}

// ── Bakje: offertes waarvan de legstatus onduidelijk is ──────────────────

function Bakje({ uitleg, leeg, items }: { uitleg: string; leeg: string; items: ReviewItem[] }) {
  return (
    <Card>
      <p className="border-b border-hair px-5 py-3 text-[12.5px] leading-relaxed text-ink-mute">
        {uitleg}
      </p>
      {items.length === 0 ? (
        <Empty>{leeg}</Empty>
      ) : (
        <>
          <div className="flex items-center gap-x-4 border-b border-hair px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
            <span className="flex-1">Klant</span>
            <span className="shrink-0">m²</span>
            <span className="w-[74px] shrink-0 text-right">Prijs/m²</span>
            <span className="w-[74px] shrink-0 text-right">Arbeid</span>
            <span className="w-[196px] shrink-0" aria-hidden />
          </div>
          <ul className="divide-y divide-hair">
            {items.map((item) => (
              <ReviewRow key={item.id} item={item} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const [busy, setBusy] = useState<'loose' | 'ok' | 'undo' | null>(null);
  const [open, setOpen] = useState(false);
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

  // Eén regel per offerte. Alles wat je niet nodig hebt om te beslissen (status,
  // datum, volledige offertetekst) zit achter het pijltje.
  const m2 = item.lines.reduce((s, l) => s + l.m2, 0);
  const prijzen = item.lines.map((l) => l.pricePerM2).filter((p): p is number => p != null && p > 0);
  const prijs = prijzen.length > 0 ? Math.min(...prijzen) : null;

  return (
    <li className={cn('px-5 py-2.5', afgehandeld && 'bg-sunk/30')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown
            size={13}
            strokeWidth={2.2}
            className={cn('shrink-0 text-ink-faint transition', open && 'rotate-180')}
          />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
            {item.customerName || item.name || 'Offerte'}
          </span>
          {item.resolved && <Badge tone="accent">los verkocht</Badge>}
          {item.reviewed && !item.resolved && <Badge tone="good">klopt zo</Badge>}
        </button>

        <span className="shrink-0 text-[12.5px] tabular-nums text-ink-mute">
          {formatNumber(m2)} m²
        </span>
        <span className="w-[74px] shrink-0 text-right text-[12.5px] tabular-nums text-ink-soft">
          {prijs == null ? '—' : `${formatEuro(prijs, true)}/m²`}
        </span>
        <span className="w-[74px] shrink-0 text-right text-[13.5px] font-bold tabular-nums text-ink">
          {formatEuro(item.laborAtStake)}
        </span>

        <div className="flex w-[196px] shrink-0 items-center justify-end gap-2">
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

      {open && (
        <dl className="ml-[23px] mt-2 space-y-1 border-l border-hair pl-3 text-[12px]">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-faint">Status</dt>
            <dd className="text-ink-soft">
              {STATUS_LABEL[item.status]} · {item.date}
            </dd>
          </div>
          {item.lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-faint">{i === 0 ? 'Regels' : ''}</dt>
              <dd className="min-w-0 text-ink-soft">
                {l.desc || formatProduct(l.code)}
                <span className="ml-2 whitespace-nowrap text-ink-faint">
                  {formatNumber(l.m2)} m² · {formatEuro(l.pricePerM2, true)}/m²
                  {l.installMode === 'glued' && ' · gelijmd'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {error && <p className="ml-[23px] mt-2 text-[12px] text-crit">{error}</p>}
    </li>
  );
}

// ── Bakje: inkoopprijzen, direct invulbaar ───────────────────────────────

function PrijzenBakje({ missing }: { missing: MissingPrice[] }) {
  const [opgeslagen, setOpgeslagen] = useState<Set<string>>(new Set());

  return (
    <Card>
      <p className="border-b border-hair px-5 py-3 text-[12.5px] leading-relaxed text-ink-mute">
        Zonder inkoopprijs valt er geen marge te berekenen, dus deze omzet telt nergens in mee. Vul
        de prijs hier direct in — hij geldt met terugwerkende kracht, want een inkoopprijs is een
        feit dat er altijd al was, alleen niet vastgelegd. De marges rekenen door bij de
        eerstvolgende synchronisatie.
      </p>
      {missing.length === 0 ? (
        <Empty>Elke vloer die voorkomt heeft een inkoopprijs.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="border-b border-hair text-[10.5px] uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-2 text-left font-semibold">Vloer</th>
                <th className="px-5 py-2 text-right font-semibold">Offertes</th>
                <th className="px-5 py-2 text-right font-semibold">m²</th>
                <th className="px-5 py-2 text-right font-semibold">Omzet zonder marge</th>
                <th className="px-5 py-2 text-right font-semibold">Inkoopprijs</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((m) => (
                <tr
                  key={m.code}
                  className={cn(
                    'border-b border-hair last:border-0 hover:bg-sunk/60',
                    opgeslagen.has(m.code) && 'bg-good-soft/40',
                  )}
                >
                  <td className="px-5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-sunk px-1.5 py-0.5 text-[12px] font-medium text-ink-soft">
                      <Tag size={11} strokeWidth={2} className="text-ink-faint" />
                      {formatProduct(m.code)}
                    </span>
                    {m.derived && !m.tooGeneric && (
                      <span
                        className="ml-2 text-[11px] text-ink-faint"
                        title="De naam komt uit de offertetekst omdat er geen P-nummer in stond"
                      >
                        naam uit offertetekst
                      </span>
                    )}
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
                  <td className="px-5 py-2.5 text-right">
                    {m.tooGeneric ? (
                      <span
                        className="text-[11.5px] text-ink-faint"
                        title="Hieronder vallen tientallen verschillende vloeren; één prijs zou een fout getal opleveren"
                      >
                        categorie — prijs per offerte
                      </span>
                    ) : (
                      <PriceInput
                        code={m.code}
                        onSaved={(code) => setOpgeslagen((s) => new Set(s).add(code))}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Bakje: offertes zonder herkende vloer ────────────────────────────────

function GeenVloerBakje({ items }: { items: UnmatchedQuotation[] }) {
  return (
    <Card>
      <p className="border-b border-hair px-5 py-3 text-[12.5px] leading-relaxed text-ink-mute">
        Meestal een project dat per ruimte is uitgesplitst: de regel heet &ldquo;Ruimte 1.18
        Kantine&rdquo; en de groepskop zegt &ldquo;BEGANE GROND&rdquo;, dus nergens staat welke
        vloer het is. De omzet telt gewoon mee, de <strong>m² niet</strong>{' '}— we herkennen geen
        enkele vloerregel om ze aan op te hangen. Dat is bewust: in dezelfde offertes staat
        &ldquo;Verwijderen en afvoeren tapijt 370&rdquo; met net zo goed m², en een ruimere regel
        zou die meesleuren. Kies per offerte: <strong>uitsluiten</strong>{' '}als hij nergens in
        hoort, of <strong>gezien</strong>{' '}als de omzet klopt en je accepteert dat de m² ontbreken.
      </p>
      {items.length === 0 ? (
        <Empty>In elke offerte met omzet is minstens één vloerregel herkend.</Empty>
      ) : (
        <>
          <div className="flex items-center gap-x-4 border-b border-hair px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
            <span className="flex-1">Klant</span>
            <span className="w-[86px] shrink-0 text-right">Omzet</span>
            <span className="w-[188px] shrink-0" aria-hidden />
          </div>
          <ul className="divide-y divide-hair">
            {items.slice(0, 40).map((u) => (
              <UnmatchedRow key={u.id} item={u} />
            ))}
          </ul>
          {items.length > 40 && (
            <p className="border-t border-hair px-5 py-2.5 text-[11.5px] text-ink-faint">
              40 van {items.length} getoond, grootste omzet eerst.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function UnmatchedRow({ item }: { item: UnmatchedQuotation }) {
  const [busy, setBusy] = useState<'excl' | 'ok' | 'undo' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>, which: 'excl' | 'ok' | 'undo') {
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
      window.location.reload();
    } catch {
      setError('Opslaan mislukt (netwerk).');
      setBusy(null);
    }
  }

  return (
    <li className={cn('px-5 py-2.5', item.reviewed && 'bg-sunk/30')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <span className="text-[13.5px] font-semibold text-ink">
            {item.customerName || item.name || 'Offerte'}
          </span>
          <span className="ml-2 text-[11.5px] text-ink-faint">
            {STATUS_LABEL[item.status]} · {item.date}
          </span>
          {item.reviewed && (
            <Badge tone="good" className="ml-2">
              gezien
            </Badge>
          )}
        </div>
        <span className="w-[86px] shrink-0 text-right text-[13.5px] font-bold tabular-nums text-ink">
          {formatEuro(item.revenueExVat)}
        </span>
        <div className="flex w-[188px] shrink-0 items-center justify-end gap-2">
          {item.reviewed ? (
            <Button
              variant="ghost"
              disabled={busy != null}
              onClick={() => post({ type: 'reviewed', reviewed: false, scope: 'unmatched' }, 'undo')}
            >
              {busy ? '…' : 'Terugdraaien'}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={busy != null}
                title="Volledig uit alle cijfers halen"
                onClick={() =>
                  post(
                    {
                      type: 'exclude',
                      reason: 'Geen vloerregel herkend — uitgesloten via Controleren',
                    },
                    'excl',
                  )
                }
              >
                <Ban size={12} strokeWidth={2.2} />
                {busy === 'excl' ? '…' : 'Uitsluiten'}
              </Button>
              <Button
                variant="primary"
                disabled={busy != null}
                onClick={() => post({ type: 'reviewed', reviewed: true, scope: 'unmatched' }, 'ok')}
              >
                {busy === 'ok' ? '…' : 'Gezien'}
              </Button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-[12px] text-crit">{error}</p>}
    </li>
  );
}
