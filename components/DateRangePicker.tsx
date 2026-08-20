'use client';

import { useState } from 'react';

export type Compare = 'none' | 'previous' | 'year';
export interface RangeState {
  from: string;
  to: string;
  compare: Compare;
  preset: string;
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];
const today = () => iso(Date.now());

const PRESETS = [
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: '180', label: '180d' },
  { key: '365', label: '12m' },
  { key: 'ytd', label: 'Dit jaar' },
  { key: 'all', label: 'Alles' },
  { key: 'custom', label: 'Aangepast' },
] as const;

export function presetRange(preset: string, from?: string, to?: string): { from: string; to: string } {
  const t = today();
  switch (preset) {
    case '30':
      return { from: iso(Date.now() - 29 * DAY), to: t };
    case '90':
      return { from: iso(Date.now() - 89 * DAY), to: t };
    case '180':
      return { from: iso(Date.now() - 179 * DAY), to: t };
    case '365':
      return { from: iso(Date.now() - 364 * DAY), to: t };
    case 'ytd':
      return { from: `${new Date().getUTCFullYear()}-01-01`, to: t };
    case 'all':
      return { from: '2000-01-01', to: t };
    case 'custom':
      return { from: from || iso(Date.now() - 89 * DAY), to: to || t };
    default:
      return { from: iso(Date.now() - 89 * DAY), to: t };
  }
}

export default function DateRangePicker({
  value,
  onChange,
  loading,
}: {
  value: RangeState;
  onChange: (s: RangeState) => void;
  loading?: boolean;
}) {
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);

  function pick(preset: string) {
    if (preset === 'custom') {
      const r = presetRange('custom', customFrom, customTo);
      onChange({ ...value, preset, from: r.from, to: r.to });
    } else {
      const r = presetRange(preset);
      onChange({ ...value, preset, from: r.from, to: r.to });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-line bg-white p-0.5 text-xs">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => pick(p.key)}
            disabled={loading}
            className={`rounded-md px-2.5 py-1 font-medium transition disabled:opacity-50 ${
              value.preset === p.key
                ? 'bg-ink text-white'
                : 'text-ink-mute hover:text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.preset === 'custom' && (
        <div className="flex items-center gap-1 text-xs">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded border border-line bg-white px-2 py-1 outline-none focus:border-accent"
          />
          <span className="text-ink-faint">–</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={today()}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded border border-line bg-white px-2 py-1 outline-none focus:border-accent"
          />
          <button
            onClick={() => onChange({ ...value, preset: 'custom', from: customFrom, to: customTo })}
            disabled={loading}
            className="rounded-md bg-accent px-2 py-1 font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            Toon
          </button>
        </div>
      )}

      <select
        value={value.compare}
        onChange={(e) => onChange({ ...value, compare: e.target.value as Compare })}
        disabled={loading}
        className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink-soft outline-none focus:border-accent disabled:opacity-50"
        title="Vergelijk met"
      >
        <option value="none">Geen vergelijking</option>
        <option value="previous">vs vorige periode</option>
        <option value="year">vs vorig jaar</option>
      </select>

      {loading && <span className="text-xs text-ink-faint">laden…</span>}
    </div>
  );
}
