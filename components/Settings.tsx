'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CurrentPrice, CurrentCost, Exclusion } from '@/lib/db';
import { formatProduct } from '@/lib/format';

const TABS = [
  { key: 'prijzen' as const, label: 'Prijzen' },
  { key: 'kosten' as const, label: 'Kosten' },
  { key: 'uitsluitingen' as const, label: 'Uitsluitingen' },
];
type TabKey = (typeof TABS)[number]['key'];

const COST_LABELS: Record<string, string> = {
  labor: 'Arbeid',
  primer: 'Primer',
  glue: 'Lijm',
  leveling: 'Egaline',
  selfadhesive: 'Zelfklevend',
};

interface State {
  prices: CurrentPrice[];
  costs: CurrentCost[];
  exclusions: Exclusion[];
}

export default function Settings({ initial }: { initial: State }) {
  const [tab, setTab] = useState<TabKey>('prijzen');
  const [state, setState] = useState<State>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function post(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState({ prices: data.prices, costs: data.costs, exclusions: data.exclusions });
        setMessage('Opgeslagen. Geldt vanaf vandaag voor nieuwe offertes (zichtbaar na de volgende sync).');
        return true;
      }
      setMessage(data.error || 'Opslaan mislukt.');
      return false;
    } catch {
      setMessage('Opslaan mislukt (netwerk).');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Instellingen</h1>
          <p className="mt-0.5 text-sm text-ink-mute">Prijzen, kosten en uitsluitingen</p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
        >
          ← Terug naar dashboard
        </Link>
      </header>

      <div className="mt-4 rounded-lg border border-warn/25 bg-warn-soft px-4 py-2 text-xs text-warn">
        Wijzigingen zijn <strong>niet met terugwerkende kracht</strong>: ze gelden vanaf vandaag voor
        nieuwe offertes. Bestaande offertes behouden hun prijs. Het effect wordt zichtbaar na de
        volgende synchronisatie.
      </div>

      <div className="mt-4 flex rounded-lg border border-line p-0.5 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              tab === t.key ? 'bg-ink text-white' : 'text-ink-mute hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="mt-3 rounded-lg border border-line bg-white px-4 py-2 text-sm text-ink-soft shadow-sm">
          {message}
        </div>
      )}

      <div className="mt-4">
        {tab === 'prijzen' && <PricesTab prices={state.prices} post={post} busy={busy} />}
        {tab === 'kosten' && <CostsTab costs={state.costs} post={post} busy={busy} />}
        {tab === 'uitsluitingen' && (
          <ExclusionsTab exclusions={state.exclusions} post={post} busy={busy} />
        )}
      </div>
    </div>
  );
}

type Post = (payload: Record<string, unknown>) => Promise<boolean>;

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">{children}</div>;
}

// ── Prijzen ──────────────────────────────────────────────────────────────
function PricesTab({ prices, post, busy }: { prices: CurrentPrice[]; post: Post; busy: boolean }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const filtered = prices.filter((p) => p.code.toLowerCase().includes(query.toLowerCase()));

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek P-nummer / product…"
          className="w-56 rounded-lg border border-line px-3 py-1.5 text-xs outline-none focus:border-accent"
        />
        <span className="text-xs text-ink-faint">{filtered.length} producten</span>
      </div>

      <div className="max-h-[440px] overflow-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-sunk text-xs text-ink-mute">
            <tr className="border-b border-line">
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-left font-medium">Inkoopprijs / m²</th>
              <th className="px-3 py-2 text-left font-medium">Geldig sinds</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {filtered.map((p) => {
              const val = edits[p.code] ?? String(p.price);
              const changed = Number(val) !== p.price && val.trim() !== '';
              return (
                <tr key={p.code} className="hover:bg-sunk">
                  <td className="px-3 py-2">
                    <span className="rounded bg-sunk px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                      {formatProduct(p.code)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-ink-faint">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={val}
                        onChange={(e) => setEdits((s) => ({ ...s, [p.code]: e.target.value }))}
                        className="w-24 rounded border border-line px-2 py-1 text-sm tabular-nums outline-none focus:border-accent"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-faint tabular-nums">{p.effectiveFrom}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={busy || !changed}
                      onClick={async () => {
                        const ok = await post({ type: 'price', code: p.code, price: Number(val) });
                        if (ok) setEdits((s) => ({ ...s, [p.code]: '' }));
                      }}
                      className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
                    >
                      Opslaan
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-hair pt-4">
        <div>
          <label className="block text-xs text-ink-mute">Nieuw product (P-nummer of naam)</label>
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="bv. P620"
            className="mt-1 w-48 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-mute">Prijs / m²</label>
          <input
            type="number"
            step="0.01"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-28 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          disabled={busy || !newCode.trim() || !newPrice.trim()}
          onClick={async () => {
            const ok = await post({ type: 'price', code: newCode, price: Number(newPrice) });
            if (ok) {
              setNewCode('');
              setNewPrice('');
            }
          }}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
        >
          Toevoegen
        </button>
      </div>
    </Card>
  );
}

// ── Kosten ───────────────────────────────────────────────────────────────
const BUILTIN_COSTS = ['labor', 'primer', 'glue', 'leveling', 'selfadhesive'];
const GLUED_COSTS = new Set(['primer', 'glue', 'leveling']);
const SELF_ADHESIVE_COSTS = new Set(['selfadhesive']);

function costLabel(key: string): string {
  return COST_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function CostsTab({ costs, post, busy }: { costs: CurrentCost[]; post: Post; busy: boolean }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  const byKey = new Map(costs.map((c) => [c.key, c]));
  const extraKeys = costs.map((c) => c.key).filter((k) => !BUILTIN_COSTS.includes(k)).sort();
  const orderedKeys = [...BUILTIN_COSTS.filter((k) => byKey.has(k)), ...extraKeys];

  return (
    <Card>
      <p className="mb-3 text-sm text-ink-mute">
        Kosten per m². <strong>Arbeid</strong> en <strong>extra kosten</strong> gelden voor élke
        gelegde vloer — behalve waar de offerte het leggen uitsluit.
        <strong>Primer/lijm/egaline</strong> gelden alleen bij gelijmd PVC en{' '}
        <strong>zelfklevend</strong> alleen bij een zelfklevende ondervloer; die twee sluiten
        elkaar uit, een vloer krijgt er nooit allebei.
      </p>

      <div className="space-y-2">
        {orderedKeys.map((key) => {
          const c = byKey.get(key);
          const cur = c?.value ?? 0;
          const val = edits[key] ?? String(cur);
          const changed = Number(val) !== cur && val.trim() !== '';
          const scope = GLUED_COSTS.has(key)
            ? 'gelijmd PVC'
            : SELF_ADHESIVE_COSTS.has(key)
              ? 'zelfklevend'
              : 'per m²';
          return (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-hair px-3 py-2">
              <span className="w-28 shrink-0 text-sm font-medium text-ink-soft">{costLabel(key)}</span>
              <span className="text-ink-faint">€</span>
              <input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
                className="w-28 rounded border border-line px-2 py-1 text-sm tabular-nums outline-none focus:border-accent"
              />
              <span className="hidden text-xs text-ink-faint sm:inline">
                {scope} · sinds {c?.effectiveFrom ?? '—'}
              </span>
              <button
                disabled={busy || !changed}
                onClick={async () => {
                  const ok = await post({ type: 'cost', key, value: Number(val) });
                  if (ok) setEdits((s) => ({ ...s, [key]: '' }));
                }}
                className="ml-auto rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
              >
                Opslaan
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-hair pt-4">
        <div>
          <label className="block text-xs text-ink-mute">Nieuwe kostenpost (naam)</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="bv. transport"
            className="mt-1 w-48 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-mute">Bedrag / m²</label>
          <input
            type="number"
            step="0.01"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-28 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          disabled={busy || !newName.trim() || !newValue.trim()}
          onClick={async () => {
            const ok = await post({ type: 'cost', key: newName.trim().toLowerCase(), value: Number(newValue) });
            if (ok) {
              setNewName('');
              setNewValue('');
            }
          }}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
        >
          Toevoegen
        </button>
        <p className="w-full text-xs text-ink-faint">
          Extra kosten gelden per m² op alle gematchte vloer, vanaf vandaag (niet met terugwerkende kracht).
        </p>
      </div>
    </Card>
  );
}

// ── Uitsluitingen ─────────────────────────────────────────────────────────
function ExclusionsTab({
  exclusions,
  post,
  busy,
}: {
  exclusions: Exclusion[];
  post: Post;
  busy: boolean;
}) {
  const [id, setId] = useState('');
  const [reason, setReason] = useState('');

  return (
    <Card>
      <p className="mb-3 text-sm text-ink-mute">
        Uitgesloten offertes tellen niet mee in de KPI&apos;s. Plak de <strong>Quotation ID</strong> (uit de
        offertetabel).
      </p>

      <div className="flex flex-wrap items-end gap-2 border-b border-hair pb-4">
        <div>
          <label className="block text-xs text-ink-mute">Offerte-ID</label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="quotation id…"
            className="mt-1 w-72 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-mute">Reden (optioneel)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="bv. testofferte"
            className="mt-1 w-48 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          disabled={busy || !id.trim()}
          onClick={async () => {
            const ok = await post({ type: 'exclusion-add', id, reason });
            if (ok) {
              setId('');
              setReason('');
            }
          }}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
        >
          Uitsluiten
        </button>
      </div>

      <ul className="mt-3 space-y-1.5">
        {exclusions.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-faint">Geen uitsluitingen.</li>
        )}
        {exclusions.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-lg border border-hair px-3 py-2 text-sm"
          >
            <code className="truncate text-xs text-ink-soft">{e.id}</code>
            {e.reason && <span className="text-xs text-ink-faint">· {e.reason}</span>}
            <button
              disabled={busy}
              onClick={() => post({ type: 'exclusion-remove', id: e.id })}
              className="ml-auto rounded-md border border-line px-2 py-1 text-xs text-ink-mute transition hover:text-crit disabled:opacity-40"
            >
              Verwijderen
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
