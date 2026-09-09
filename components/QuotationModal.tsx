'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, RotateCcw, X } from 'lucide-react';
import type { QuotationFields, QuotationLineOverride, QuotationRow, QuotationStatus } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import PriceInput from './PriceInput';
import QuotationCorrection from './QuotationCorrection';

export const STATUS_STYLE: Record<QuotationStatus, string> = {
  accepted: 'bg-good-soft text-good ring-good/30',
  open: 'bg-oak-soft text-oak ring-oak/30',
  refused: 'bg-crit-soft text-crit ring-crit/30',
  // Verlopen is een verlies, maar geen afwijzing — grijs in plaats van rood,
  // zodat je in één blik ziet dat hier niemand 'nee' heeft gezegd.
  expired: 'bg-sunk text-ink-mute ring-ink-faint/30',
};

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  accepted: 'Geaccepteerd',
  open: 'Open',
  refused: 'Geweigerd',
  expired: 'Verlopen',
};

export function marginColor(margin: number | null): string {
  if (margin == null) return 'text-ink-faint';
  return margin >= 0 ? 'text-ink' : 'text-crit';
}

/** Leeg tekstveld = geen correctie; anders het getal. */
const numOrUndef = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * De offertemodal: alle cijfers van één offerte, en sinds de feedback van
 * 27 augustus ook bewerkbaar.
 *
 * Waarom bewerkbaar. Teamleader is de bron, maar niet altijd de waarheid: een
 * offerte staat op de verkeerde status, een aantal is in m² ingevoerd terwijl er
 * stuks stonden, of een regel hoort bij een ander project. Zulke dingen waren
 * alleen op te lossen door ze in Teamleader te wijzigen, en dat gebeurt in de
 * praktijk niet meer bij een afgeronde offerte.
 *
 * Wat een mens hier aanpast wordt bij het lezen toegepast (lib/resolve.ts) en
 * overleeft dus elke sync. Klantnaam, plaats en postcode blijven bewust uit
 * Teamleader komen: daar hangen de klant- en regioanalyses aan.
 */
export default function QuotationModal({
  q,
  onClose,
  pricedCodes,
}: {
  q: QuotationRow;
  onClose: () => void;
  pricedCodes?: Set<string>;
}) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [savedCodes, setSavedCodes] = useState<Set<string>>(new Set());
  const [bewerken, setBewerken] = useState(false);
  const [fields, setFields] = useState<QuotationFields>({});
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  // Wat er al handmatig is aangepast, zodat de modal het kan merken én zodat
  // opslaan bovenop de bestaande correcties gaat in plaats van ze te wissen.
  useEffect(() => {
    let leeft = true;
    fetch('/api/overrides')
      .then((r) => r.json())
      .then((d) => {
        if (!leeft) return;
        setFields(d.overrides?.[q.id]?.fields ?? {});
      })
      .catch(() => {});
    return () => {
      leeft = false;
    };
  }, [q.id]);

  const lines = q.lines ?? [];
  const aangepast = (key: string): boolean => {
    if (key.startsWith('lines.')) {
      const [, i, veld] = key.split('.');
      return (fields.lines?.[i] as Record<string, unknown> | undefined)?.[veld] != null;
    }
    return (fields as Record<string, unknown>)[key] != null;
  };

  const isUnpriced = (code: string, margin: number | null) =>
    margin === null && !pricedCodes?.has(code.toLowerCase()) && !savedCodes.has(code.toLowerCase());
  const hasUnpriced = lines.some((l) => isUnpriced(l.code, l.margin));
  const location = [q.postalCode, q.city].filter(Boolean).join(' ');
  const dateLabel = q.status === 'refused' ? 'Geweigerd' : q.status === 'expired' ? 'Verlopen' : 'Geaccepteerd';

  function zetVeld(key: keyof QuotationFields, waarde: string | number | undefined) {
    setFields((f) => {
      const next = { ...f };
      if (waarde === undefined || waarde === '') delete next[key];
      else (next as Record<string, unknown>)[key] = waarde;
      return next;
    });
  }

  function zetRegel(i: number, veld: keyof QuotationLineOverride, waarde: string | number | undefined) {
    setFields((f) => {
      const regels = { ...(f.lines ?? {}) };
      const regel = { ...(regels[String(i)] ?? {}) } as Record<string, unknown>;
      if (waarde === undefined || waarde === '') delete regel[veld];
      else regel[veld] = waarde;
      if (Object.keys(regel).length === 0) delete regels[String(i)];
      else regels[String(i)] = regel as QuotationLineOverride;
      if (Object.keys(regels).length === 0) {
        const { lines: _weg, lineCount: _ook, ...rest } = f;
        return rest;
      }
      return { ...f, lines: regels, lineCount: lines.length };
    });
  }

  async function bewaar(nieuw: QuotationFields | null) {
    setBusy(true);
    setFout(null);
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'fields', quotationId: q.id, fields: nieuw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setFout(data.error || 'Opslaan mislukt.');
        return;
      }
      setBewerken(false);
      // Alles herrekenen: de correctie raakt niet alleen deze offerte maar elke
      // KPI waarin hij meetelt.
      router.refresh();
      onClose();
    } catch {
      setFout('Opslaan mislukt (netwerk).');
    } finally {
      setBusy(false);
    }
  }

  const heeftCorrecties = Object.keys(fields).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={[
          // Ruimer dan de oude max-w-2xl: er staan acht kerncijfers, een
          // regeltabel en een correctieblok in, en die stonden geknepen.
          'flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface',
          'max-h-[90vh] border border-line',
          'shadow-[0_24px_64px_-16px_rgba(28,25,23,0.45)]',
          'animate-rise-in',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-ink">
                {q.customerName || '—'}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ${STATUS_STYLE[q.status]}`}
              >
                {STATUS_LABEL[q.status]}
              </span>
              {heeftCorrecties && (
                <span className="shrink-0 rounded-full bg-oak-soft px-2 py-0.5 text-xs text-oak ring-1 ring-oak/30">
                  Handmatig aangepast
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-ink-mute">
              {q.name}
              {location && <span className="text-ink-faint"> · {location}</span>}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint tabular-nums">
              Aangemaakt {q.dateCreated || '—'}
              {q.dateAccepted && ` · ${dateLabel} ${q.dateAccepted}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBewerken((b) => !b)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                  bewerken ? 'bg-ink text-white' : 'text-ink-mute hover:bg-sunk hover:text-ink'
                }`}
              >
                <Pencil size={12} strokeWidth={2.2} />
                {bewerken ? 'Klaar met bewerken' : 'Bewerken'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-ink-faint hover:bg-sunk hover:text-ink-soft"
                aria-label="Sluiten"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs text-ink-mute">
              <span>
                Dekking:{' '}
                <strong className="text-ink-soft">{formatPercent(q.matchCoverage)}</strong>
              </span>
              {q.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-good ring-1 ring-good/30">
                  ✓ Geverifieerd
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Omzet (ex btw)"
              value={formatEuro(q.revenueExVat, true)}
              bewerken={bewerken}
              aangepast={aangepast('revenueExVat')}
              invoer={
                <NumberVeld
                  waarde={fields.revenueExVat}
                  plaats={q.revenueExVat}
                  onChange={(v) => zetVeld('revenueExVat', v)}
                />
              }
            />
            <Stat label="Omzet (incl btw)" value={formatEuro(q.revenueInclVat, true)} />
            <Stat
              label="Vloeromzet (ex btw)"
              value={formatEuro(q.omzetVloer, true)}
              bewerken={bewerken}
              aangepast={aangepast('omzetVloer')}
              invoer={
                <NumberVeld
                  waarde={fields.omzetVloer}
                  plaats={q.omzetVloer}
                  onChange={(v) => zetVeld('omzetVloer', v)}
                />
              }
            />
            <Stat label="Prijs/m²" value={formatEuro(q.prijsPerM2, true)} />
            <Stat label="M² totaal" value={formatNumber(q.totalM2)} />
            <Stat label="Kostprijs" value={formatEuro(q.cost, true)} />
            <Stat label="Marge" value={formatEuro(q.margin, true)} className={marginColor(q.margin)} />
            <Stat
              label="Marge %"
              value={formatPercent(q.marginPct)}
              className={marginColor(q.margin)}
            />
          </div>

          {bewerken && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-hair bg-sunk/40 p-3 sm:grid-cols-3">
              <Veld label="Status" aangepast={aangepast('status')}>
                <select
                  value={fields.status ?? q.status}
                  onChange={(e) => zetVeld('status', e.target.value)}
                  className="w-full rounded border border-line bg-white px-2 py-1 text-xs outline-none focus:border-accent"
                >
                  {(Object.keys(STATUS_LABEL) as QuotationStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Veld>
              <Veld label="Aangemaakt" aangepast={aangepast('dateCreated')}>
                <input
                  type="date"
                  value={fields.dateCreated ?? q.dateCreated}
                  onChange={(e) => zetVeld('dateCreated', e.target.value)}
                  className="w-full rounded border border-line bg-white px-2 py-1 text-xs tabular-nums outline-none focus:border-accent"
                />
              </Veld>
              <Veld label="Beslisdatum" aangepast={aangepast('dateAccepted')}>
                <input
                  type="date"
                  value={fields.dateAccepted ?? q.dateAccepted}
                  onChange={(e) => zetVeld('dateAccepted', e.target.value)}
                  className="w-full rounded border border-line bg-white px-2 py-1 text-xs tabular-nums outline-none focus:border-accent"
                />
              </Veld>
              <p className="text-[11px] leading-relaxed text-ink-faint sm:col-span-3">
                Status en datums bepalen in welke periode deze offerte meetelt. Klantnaam en plaats
                blijven uit Teamleader komen — daar hangen de klant- en regioanalyses aan.
              </p>
            </div>
          )}

          {/* Floor lines */}
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-ink-mute">Vloerregels</p>
            {lines.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="bg-sunk text-ink-faint">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Product</th>
                      <th className="px-3 py-1.5 text-right font-medium">M²</th>
                      <th className="px-3 py-1.5 text-right font-medium">Omzet</th>
                      {bewerken && <th className="px-3 py-1.5 text-right font-medium">Ondervloer/m²</th>}
                      {bewerken && <th className="px-3 py-1.5 text-right font-medium">Arbeid/m²</th>}
                      <th className="px-3 py-1.5 text-right font-medium">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hair">
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">
                          {bewerken ? (
                            <input
                              value={fields.lines?.[String(i)]?.code ?? l.code}
                              onChange={(e) => zetRegel(i, 'code', e.target.value)}
                              className="w-40 rounded border border-line px-1.5 py-0.5 text-xs outline-none focus:border-accent"
                            />
                          ) : (
                            <span className="rounded bg-sunk px-1.5 py-0.5 font-medium text-ink-soft">
                              {formatProduct(l.code)}
                            </span>
                          )}
                          {l.desc && (
                            <span
                              className="mt-0.5 block max-w-[16rem] truncate text-[11px] text-ink-faint"
                              title={l.desc}
                            >
                              {l.desc}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">
                          {bewerken ? (
                            <NumberVeld
                              waarde={fields.lines?.[String(i)]?.m2}
                              plaats={l.m2}
                              onChange={(v) => zetRegel(i, 'm2', v)}
                            />
                          ) : (
                            formatNumber(l.m2)
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">
                          {bewerken ? (
                            <NumberVeld
                              waarde={fields.lines?.[String(i)]?.revenue}
                              plaats={l.revenue}
                              onChange={(v) => zetRegel(i, 'revenue', v)}
                            />
                          ) : (
                            formatEuro(l.revenue, true)
                          )}
                        </td>
                        {bewerken && (
                          <td className="px-3 py-1.5 text-right">
                            <NumberVeld
                              waarde={fields.lines?.[String(i)]?.underlayPerM2}
                              plaats={l.underlayPerM2 ?? 0}
                              onChange={(v) => zetRegel(i, 'underlayPerM2', v)}
                            />
                          </td>
                        )}
                        {bewerken && (
                          <td className="px-3 py-1.5 text-right">
                            <NumberVeld
                              waarde={fields.lines?.[String(i)]?.laborPerM2}
                              plaats={l.laborPerM2 ?? 0}
                              onChange={(v) => zetRegel(i, 'laborPerM2', v)}
                            />
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {isUnpriced(l.code, l.margin) ? (
                            <PriceInput
                              code={l.code}
                              onSaved={(c) =>
                                setSavedCodes((s) => new Set(s).add(c.toLowerCase()))
                              }
                            />
                          ) : (
                            <span className={marginColor(l.margin)}>{formatEuro(l.margin, true)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasUnpriced && (
                  <p className="border-t border-hair bg-warn-soft/50 px-3 py-1.5 text-xs text-warn">
                    Vul de inkoopprijs (€/m²) in bij regels zonder marge. Die geldt voor het product
                    en werkt meteen door in alle offertes waarin het voorkomt.
                  </p>
                )}
              </div>
            ) : (
              <span className="text-xs text-ink-faint">
                Geen gematchte vloerregels
                {q.matchCoverage != null && q.matchCoverage < 100
                  ? ' — voeg ontbrekende prijzen toe in Instellingen.'
                  : '.'}
              </span>
            )}
          </div>

          {bewerken && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hair pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => bewaar(Object.keys(fields).length > 0 ? fields : null)}
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
              >
                {busy ? 'Opslaan…' : 'Correcties opslaan'}
              </button>
              {heeftCorrecties && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setFields({});
                    bewaar(null);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:text-ink disabled:opacity-40"
                >
                  <RotateCcw size={13} strokeWidth={2} />
                  Alles terug naar Teamleader
                </button>
              )}
              <span className="text-[11px] text-ink-faint">
                Leeg laten betekent: neem over wat Teamleader zegt.
              </span>
              {fout && <span className="w-full text-xs text-crit">{fout}</span>}
            </div>
          )}

          <QuotationCorrection q={q} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className = 'text-ink',
  bewerken = false,
  aangepast = false,
  invoer,
}: {
  label: string;
  value: string;
  className?: string;
  bewerken?: boolean;
  aangepast?: boolean;
  invoer?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-sunk px-3 py-2">
      <div className="flex items-center gap-1 text-xs text-ink-faint">
        {label}
        {aangepast && <span title="Handmatig aangepast" className="text-oak">•</span>}
      </div>
      {bewerken && invoer ? (
        <div className="mt-1">{invoer}</div>
      ) : (
        <div className={`mt-0.5 text-sm font-semibold tabular-nums ${className}`}>{value}</div>
      )}
    </div>
  );
}

function Veld({
  label,
  aangepast,
  children,
}: {
  label: string;
  aangepast: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[11px] text-ink-mute">
        {label}
        {aangepast && <span title="Handmatig aangepast" className="text-oak">•</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * Getalveld dat leeg blijft zolang er geen correctie is: de waarde uit
 * Teamleader staat als plaatshouder in het veld. Zo zie je in één blik wat
 * handmatig is ingevuld en wat de bron zegt, en wist je een correctie door het
 * veld leeg te maken.
 */
function NumberVeld({
  waarde,
  plaats,
  onChange,
}: {
  waarde: number | undefined;
  plaats: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <input
      type="number"
      step="0.01"
      value={waarde ?? ''}
      placeholder={String(plaats)}
      onChange={(e) => onChange(numOrUndef(e.target.value))}
      className="w-24 rounded border border-line bg-white px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-accent"
    />
  );
}
