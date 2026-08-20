'use client';

import { useEffect, useMemo, useState } from 'react';
import type { QuotationRow } from '@/lib/types';
import { formatProduct } from '@/lib/format';

/**
 * Per-quotation manual correction (feedback 2026-07-13):
 *  - a special purchase price (€/m²) per floor line, for a one-off deal;
 *  - a "los verkocht — geen legservice" toggle that drops the labour cost.
 * Corrections apply instantly + retroactively; on save we reload so every
 * recomputed number (this offerte, KPIs, trends, pipeline) refreshes.
 */
export default function QuotationCorrection({ q }: { q: QuotationRow }) {
  const codes = useMemo(() => {
    const seen = new Map<string, number | undefined>();
    for (const l of q.lines ?? []) if (!seen.has(l.code)) seen.set(l.code, l.purchasePerM2);
    return [...seen.entries()].map(([code, base]) => ({ code, base }));
  }, [q.lines]);

  const [noLabor, setNoLabor] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/overrides')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const ov = d.overrides?.[q.id];
        if (!ov) return;
        setNoLabor(Boolean(ov.noLabor));
        const p: Record<string, string> = {};
        for (const [code, val] of Object.entries(ov.prices ?? {})) p[code] = String(val);
        setPrices(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [q.id]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId: q.id, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || 'Opslaan mislukt.');
        setBusy(false);
        return;
      }
      // Reload so all recomputed figures refresh (instant + retroactive).
      window.location.reload();
    } catch {
      setError('Opslaan mislukt (netwerk).');
      setBusy(false);
    }
  }

  const toggleNoLabor = () => post({ type: 'no-labor', noLabor: !noLabor });
  const savePrice = (code: string) => {
    const raw = (prices[code] ?? '').trim().replace(',', '.');
    post({ type: 'price', lineCode: code, price: raw === '' ? null : Number(raw) });
  };

  return (
    <div className="mt-4 rounded-lg border border-line bg-sunk/60 px-3 py-3">
      <p className="mb-2 text-xs font-medium text-ink-mute">
        Correctie — uitzondering alleen voor deze offerte (werkt direct &amp; met terugwerkende kracht)
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={noLabor}
          disabled={busy}
          onChange={toggleNoLabor}
          className="h-3.5 w-3.5 rounded border-line accent-accent"
        />
        Los verkocht — geen legservice (haalt de arbeidskosten €/m² eruit)
      </label>

      {codes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-ink-faint">Afwijkende inkoopprijs per vloerregel (€/m²)</p>
          {codes.map(({ code, base }) => (
            <div key={code} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate rounded bg-sunk px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                {formatProduct(code)}
              </span>
              <span className="text-ink-faint">€</span>
              <input
                value={prices[code] ?? ''}
                onChange={(e) => setPrices((p) => ({ ...p, [code]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && savePrice(code)}
                inputMode="decimal"
                placeholder={base != null ? `standaard ${base}` : '/m²'}
                disabled={busy}
                className="w-24 rounded-md border border-line bg-white px-1.5 py-0.5 text-xs outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => savePrice(code)}
                disabled={busy}
                className="rounded-md bg-ink px-2 py-0.5 text-xs font-medium text-white transition hover:bg-ink/85 disabled:opacity-40"
              >
                {busy ? '…' : 'Opslaan'}
              </button>
              {(prices[code] ?? '') !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    setPrices((p) => ({ ...p, [code]: '' }));
                    post({ type: 'price', lineCode: code, price: null });
                  }}
                  disabled={busy}
                  className="text-xs text-ink-faint hover:text-crit disabled:opacity-40"
                  title="Correctie wissen"
                >
                  wissen
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-crit">{error}</p>}
    </div>
  );
}
