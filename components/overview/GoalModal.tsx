'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Target, X } from 'lucide-react';
import type { Goals } from '@/lib/today';

/**
 * Maanddoelen instellen. Een venster in plaats van een formulier in de kaart:
 * het kan zo vanuit de kopknop én vanuit de statement-kaart, en de zwarte
 * kaart hoeft geen invulvelden te dragen. Via een portal naar <body>, om
 * dezelfde reden als de periodekiezer: de kopbalk heeft backdrop-blur.
 */
export default function GoalModal({ goals, onClose }: { goals: Goals; onClose: () => void }) {
  const router = useRouter();
  const [w, setW] = useState({
    revenue: goals.revenue?.toString() ?? '',
    margin: goals.margin?.toString() ?? '',
    m2: goals.m2?.toString() ?? '',
  });
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function opslaan() {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) setFout(json.error || 'Opslaan mislukt.');
      else {
        onClose();
        router.refresh();
      }
    } catch {
      setFout('Opslaan mislukt (netwerk).');
    } finally {
      setBezig(false);
    }
  }

  const veld = (key: keyof typeof w, label: string, eenheid: string) => (
    <label className="block">
      <span className="text-[12.5px] font-medium text-ink-soft">{label}</span>
      <span className="mt-1.5 flex items-center rounded-2xl bg-sunk px-4 ring-1 ring-transparent transition focus-within:bg-surface focus-within:ring-ink/15">
        <span className="text-[14px] text-ink-faint">{eenheid}</span>
        <input
          inputMode="numeric"
          value={w[key]}
          onChange={(e) => setW({ ...w, [key]: e.target.value.replace(/[^\d]/g, '') })}
          placeholder="geen doel"
          className="w-full bg-transparent px-2.5 py-3 text-[15px] tabular-nums text-ink outline-none placeholder:text-ink-faint"
        />
      </span>
    </label>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-night/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md animate-rise-in rounded-[28px] bg-surface p-7 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-sunk text-ink-mute transition hover:text-ink"
        >
          <X size={16} />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <Target size={20} strokeWidth={2} />
        </span>
        <h2 className="mt-4 text-[22px] font-semibold tracking-tight text-ink">Maanddoelen</h2>
        <p className="mt-1 text-[13px] text-ink-mute">Gelden voor elke maand. Leeg laten is geen doel.</p>

        <div className="mt-6 space-y-4">
          {veld('revenue', 'Omzet geaccepteerd, ex btw', '€')}
          <div className="grid grid-cols-2 gap-3">
            {veld('margin', 'Marge', '€')}
            {veld('m2', 'Verkochte m²', 'm²')}
          </div>
        </div>

        {fout && <p className="mt-4 text-[12.5px] text-crit">{fout}</p>}
        <div className="mt-7 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-sunk px-5 py-3 text-[14px] font-medium text-ink-soft transition hover:text-ink"
          >
            Annuleren
          </button>
          <button
            type="button"
            disabled={bezig}
            onClick={opslaan}
            className="flex-1 rounded-full bg-night px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-night/90 disabled:opacity-50"
          >
            {bezig ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
