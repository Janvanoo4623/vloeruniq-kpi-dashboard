'use client';

import { useState } from 'react';

// Backdated so a newly-entered missing price applies to older quotations too
// (a purchase price is a fact that existed all along, just wasn't recorded).
const BACKDATE = '2000-01-01';

/**
 * Inline "add purchase price" control for an unpriced floor code. Saves to
 * product_prices (backdated) via /api/settings. The new price is applied to
 * margins on the next sync — the caller shows that hint.
 */
export default function PriceInput({
  code,
  onSaved,
}: {
  code: string;
  onSaved?: (code: string) => void;
}) {
  const [val, setVal] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    const price = Number(val.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) {
      setState('error');
      return;
    }
    setState('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'price', code, price, effectiveFrom: BACKDATE }),
      });
      if (res.ok) {
        setState('saved');
        onSaved?.(code);
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'saved') {
    return <span className="text-xs font-medium text-emerald-600">✓ prijs opgeslagen</span>;
  }

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-neutral-400">€</span>
      <input
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          if (state === 'error') setState('idle');
        }}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        inputMode="decimal"
        placeholder="/m²"
        aria-label={`Inkoopprijs voor ${code}`}
        className={`w-16 rounded-md border bg-white px-1.5 py-0.5 text-xs outline-none focus:border-emerald-500 ${
          state === 'error' ? 'border-rose-400' : 'border-neutral-300'
        }`}
      />
      <button
        type="button"
        onClick={save}
        disabled={state === 'saving' || val.trim() === ''}
        className="rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
      >
        {state === 'saving' ? '…' : 'Opslaan'}
      </button>
    </span>
  );
}
