'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { AdsBudgets, AdsPlatform, MonthBudgetStatus } from '@/lib/ads';
import { monthLabel } from '@/lib/ads';
import { formatEuro, formatPercent } from '@/lib/format';
import { Badge, Button } from './ui';
import { CHART } from './charts/theme';

/**
 * Budget per maand tegenover de werkelijke uitgaven. Eén beslissing per rij:
 * klik op een maand om het budget voor die maand te zetten. De standaard geldt
 * voor elke maand zonder eigen bedrag, zodat je niet elke maand hoeft te
 * typen. Het budget zelf staat nergens in Google — dit is een afspraak met
 * jezelf, geen instelling in het advertentieaccount.
 */
export default function AdsBudgetPanel({
  platform = 'google',
  months,
  budgets,
  onSaved,
}: {
  platform?: AdsPlatform;
  months: MonthBudgetStatus[];
  budgets: AdsBudgets;
  onSaved: () => Promise<void> | void;
}) {
  const [bewerk, setBewerk] = useState<string | null>(null);
  const rijen = [...months].reverse();
  // Zonder budget is de balk relatief aan de duurste maand, zodat maanden
  // onderling toch te vergelijken zijn.
  const maxRef = Math.max(1, ...months.map((m) => Math.max(m.budget ?? 0, m.spent, m.projected ?? 0)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-ink-mute">
          {budgets.default != null
            ? `Standaard ${formatEuro(budgets.default)} per maand; klik op een maand om af te wijken.`
            : 'Nog geen standaardbudget. Zet er een, of klik op een maand voor een los bedrag.'}
        </p>
        <Button onClick={() => setBewerk('default')}>Standaardbudget</Button>
      </div>

      {rijen.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-sm text-ink-faint">Geen maanden in deze periode</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left font-medium">Maand</th>
                <th className="px-3 py-2 text-right font-medium">Budget</th>
                <th className="px-3 py-2 text-right font-medium">Uitgegeven</th>
                <th className="w-[34%] px-3 py-2 text-left font-medium">Benut</th>
                <th className="px-3 py-2 text-right font-medium">Verwacht</th>
                <th className="px-3 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {rijen.map((m) => (
                <tr
                  key={m.month}
                  onClick={() => setBewerk(m.month)}
                  className="cursor-pointer hover:bg-sunk"
                  title="Klik om het budget voor deze maand te zetten"
                >
                  <td className="px-3 py-2 text-ink">
                    {m.label}
                    {m.isCurrent && <span className="ml-2 text-[11px] text-ink-faint">dag {m.daysElapsed} van {m.daysInMonth}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {m.budget != null ? formatEuro(m.budget) : '—'}
                    {m.budgetIsDefault && m.budget != null && <span className="ml-1 text-[10.5px] text-ink-faint">std</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{formatEuro(m.spent)}</td>
                  <td className="px-3 py-2">
                    <Meter m={m} maxRef={maxRef} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {m.isCurrent && m.projected != null ? formatEuro(m.projected) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.signal === 'crit' && <Badge tone="crit">boven budget</Badge>}
                    {m.signal === 'warn' && <Badge tone="warn">net erboven</Badge>}
                    {m.signal === 'good' && <Badge tone="good">binnen budget</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bewerk && (
        <BudgetModal
          platform={platform}
          month={bewerk}
          current={budgets[bewerk] ?? null}
          fallback={bewerk === 'default' ? null : (budgets.default ?? null)}
          onClose={() => setBewerk(null)}
          onSaved={async () => {
            setBewerk(null);
            await onSaved();
          }}
        />
      )}
    </div>
  );
}

/**
 * De meter: uitgegeven als gevulde balk op een spoor dat het budget is. Voor
 * de lopende maand een streepje waar het tempo uitkomt. Zonder budget is het
 * spoor de duurste maand in beeld — dan vergelijk je maanden met elkaar.
 */
function Meter({ m, maxRef }: { m: MonthBudgetStatus; maxRef: number }) {
  const ref = m.budget != null && m.budget > 0 ? m.budget : maxRef;
  const spentPct = Math.min(100, (m.spent / ref) * 100);
  const projPct = m.projected != null ? Math.min(100, (m.projected / ref) * 100) : null;
  const over = m.budget != null && m.spent > m.budget;
  const kleur = over ? CHART.refused : m.signal === 'warn' ? CHART.marginPct : CHART.adsCost;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sunk" title={m.pct != null ? `${formatPercent(m.pct)} van het budget` : 'geen budget'}>
        <div className="h-full rounded-full" style={{ width: `${spentPct}%`, background: kleur }} />
        {projPct != null && projPct > spentPct && (
          <div className="absolute top-0 h-full w-[2px] bg-ink/40" style={{ left: `${projPct}%` }} title={`verwacht ${formatEuro(m.projected)}`} />
        )}
      </div>
      {m.pct != null && <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-ink-soft">{formatPercent(m.pct)}</span>}
    </div>
  );
}

function BudgetModal({
  platform,
  month,
  current,
  fallback,
  onClose,
  onSaved,
}: {
  platform: AdsPlatform;
  month: string;
  current: number | null;
  fallback: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [bedrag, setBedrag] = useState(current != null ? String(current) : '');
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const isDefault = month === 'default';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function opslaan(amount: number | null) {
    setBusy(true);
    setFout(null);
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, month, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setFout(data.error || 'Opslaan mislukt.');
        return;
      }
      await onSaved();
    } catch {
      setFout('Opslaan mislukt (netwerk).');
    } finally {
      setBusy(false);
    }
  }

  const n = Number(bedrag.replace(',', '.'));
  const geldig = bedrag.trim() !== '' && Number.isFinite(n) && n >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(28,25,23,0.45)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink">
              {isDefault ? 'Standaardbudget per maand' : `Budget ${monthLabel(month)}`}
            </h3>
            <p className="mt-0.5 text-sm text-ink-mute">
              {isDefault
                ? 'Geldt voor elke maand zonder eigen bedrag.'
                : fallback != null
                  ? `Zonder eigen bedrag geldt de standaard van ${formatEuro(fallback)}.`
                  : 'Er is nog geen standaardbudget; dit bedrag geldt alleen voor deze maand.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-faint hover:bg-sunk hover:text-ink-soft" aria-label="Sluiten">
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>

        <form
          className="px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (geldig) void opslaan(n);
          }}
        >
          <label className="block text-[12px] font-medium text-ink-soft">Bedrag per maand, ex btw</label>
          <div className="mt-1.5 flex items-center rounded-lg border border-line bg-surface px-3 focus-within:border-accent">
            <span className="text-sm text-ink-faint">€</span>
            <input
              autoFocus
              inputMode="decimal"
              value={bedrag}
              onChange={(e) => setBedrag(e.target.value)}
              placeholder="bijv. 4000"
              className="w-full bg-transparent px-2 py-2 text-sm text-ink outline-none"
            />
          </div>
          {fout && <p className="mt-2 text-[12px] text-crit">{fout}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {current != null ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void opslaan(null)}>
                Verwijderen
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" onClick={onClose} disabled={busy}>
                Annuleren
              </Button>
              <Button type="submit" variant="primary" disabled={busy || !geldig}>
                {busy ? 'Bezig…' : 'Opslaan'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
