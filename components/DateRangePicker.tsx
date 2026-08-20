'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button, cn } from './ui';

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

export const PRESETS = [
  { key: '30', label: 'Afgelopen 30 dagen' },
  { key: '90', label: 'Afgelopen 90 dagen' },
  { key: '180', label: 'Afgelopen 180 dagen' },
  { key: '365', label: 'Afgelopen 12 maanden' },
  { key: 'ytd', label: 'Dit jaar' },
  { key: 'all', label: 'Alles' },
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
      return { from: from || iso(Date.now() - 29 * DAY), to: to || t };
    default:
      return { from: iso(Date.now() - 29 * DAY), to: t };
  }
}

const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

const kort = (d: string) => {
  const [j, m, dag] = d.split('-');
  return `${Number(dag)} ${MAANDEN[Number(m) - 1].slice(0, 3)} ${j.slice(2)}`;
};

/** Wat er op de knop staat: de naam van de periode, of de datums bij maatwerk. */
function knoplabel(v: RangeState): string {
  const p = PRESETS.find((x) => x.key === v.preset);
  if (p) return p.label;
  return `${kort(v.from)} – ${kort(v.to)}`;
}

/**
 * Periodekiezer als één knop in de kop. Voorheen stonden er zeven knoppen naast
 * elkaar plus een losse dropdown; dat vrat de halve kopbalk en het duurde nog
 * steeds twee klikken voordat je een eigen datum kon kiezen.
 *
 * Nu: de knop toont wat er geselecteerd is, en de keuze gebeurt in een dialoog
 * waar de vaste periodes en de kalender naast elkaar staan.
 */
export default function DateRangePicker({
  value,
  onChange,
  loading,
}: {
  value: RangeState;
  onChange: (s: RangeState) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5',
          'text-[13px] font-medium text-ink-soft transition',
          'hover:border-ink-faint hover:text-ink disabled:opacity-50',
        )}
      >
        <CalendarDays size={14} strokeWidth={2} className="shrink-0 text-ink-faint" />
        <span className="whitespace-nowrap">{knoplabel(value)}</span>
        {value.compare !== 'none' && (
          <span className="whitespace-nowrap rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
            {value.compare === 'year' ? 'vs vorig jaar' : 'vs vorige'}
          </span>
        )}
        {loading && <span className="text-[11px] text-ink-faint">laden…</span>}
      </button>

      {open && (
        <PeriodeDialoog
          value={value}
          onClose={() => setOpen(false)}
          onApply={(s) => {
            setOpen(false);
            onChange(s);
          }}
        />
      )}
    </>
  );
}

// ── Dialoog ──────────────────────────────────────────────────────────────

function PeriodeDialoog({
  value,
  onClose,
  onApply,
}: {
  value: RangeState;
  onClose: () => void;
  onApply: (s: RangeState) => void;
}) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const [preset, setPreset] = useState(value.preset);
  const [compare, setCompare] = useState<Compare>(value.compare);
  // Welke klik komt er straks: de begindatum of de einddatum?
  const [kiest, setKiest] = useState<'from' | 'to'>('from');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function kiesPreset(key: string) {
    const r = presetRange(key);
    setPreset(key);
    setFrom(r.from);
    setTo(r.to);
    setKiest('from');
  }

  function kiesDag(d: string) {
    if (d > today()) return;
    if (kiest === 'from' || d < from) {
      setFrom(d);
      setTo(d > to ? d : to);
      setKiest('to');
    } else {
      setTo(d);
      setKiest('from');
    }
    setPreset('custom');
  }

  const dagen = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;

  // Buiten de React-boom om naar <body>. De kopbalk gebruikt backdrop-blur, en
  // een element met backdrop-filter wordt het containing block voor alles wat
  // position:fixed is. Zonder portal centreert deze dialoog zich dus binnen die
  // 68 pixels hoge balk in plaats van binnen het scherm, en valt hij er half
  // bovenuit. Gemeten: top -214 bij een venster van 900 hoog.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 animate-fade-in bg-ink/30" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Periode kiezen"
        className={cn(
          'absolute left-1/2 top-1/2 w-[min(760px,94vw)] -translate-x-1/2 -translate-y-1/2',
          // Twee maanden naast de snelkeuzes worden hoog; op een laag scherm mag
          // de dialoog nooit half buiten beeld vallen, dus hij scrollt zelf.
          'flex max-h-[92vh] flex-col animate-rise-in overflow-hidden rounded-2xl',
          'border border-line bg-surface shadow-2xl',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hair bg-gradient-to-b from-sunk/50 to-transparent px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-bold text-ink">Periode</h2>
            <p className="mt-0.5 text-[12px] text-ink-mute">
              {kort(from)} t/m {kort(to)} · {dagen} {dagen === 1 ? 'dag' : 'dagen'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-lg p-1.5 text-ink-mute transition hover:bg-sunk hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto sm:grid-cols-[200px_1fr]">
          {/* Vaste periodes */}
          <div className="border-b border-hair p-3 sm:border-b-0 sm:border-r">
            <p className="mb-2 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Snelkeuze
            </p>
            <div className="space-y-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => kiesPreset(p.key)}
                  className={cn(
                    'w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition',
                    preset === p.key
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'text-ink-soft hover:bg-sunk hover:text-ink',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <p className="mb-2 mt-5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Vergelijken met
            </p>
            <div className="space-y-0.5">
              {(
                [
                  ['none', 'Niets'],
                  ['previous', 'Vorige periode'],
                  ['year', 'Vorig jaar'],
                ] as [Compare, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setCompare(k)}
                  className={cn(
                    'w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition',
                    compare === k
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'text-ink-soft hover:bg-sunk hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Kalender */}
          <div className="p-3">
            <Kalender from={from} to={to} kiest={kiest} onPick={kiesDag} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hair px-5 py-3">
          <p className="text-[11.5px] text-ink-faint">
            {kiest === 'from'
              ? 'Klik een dag voor de begindatum'
              : 'Klik nu de einddatum — of kies een snelkeuze'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Annuleren
            </Button>
            <Button variant="primary" onClick={() => onApply({ from, to, preset, compare })}>
              Toepassen
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Kalender: twee maanden naast elkaar ──────────────────────────────────

function Kalender({
  from,
  to,
  kiest,
  onPick,
}: {
  from: string;
  to: string;
  kiest: 'from' | 'to';
  onPick: (d: string) => void;
}) {
  // Open op de BEGINmaand, niet de eindmaand: bij een periode die twee maanden
  // overspant ("22 juli t/m 20 augustus") zie je dan de hele selectie staan.
  // Op de eindmaand ankeren verstopt juist het begin ervan.
  const [anker, setAnker] = useState(() => {
    const d = new Date(`${from}T00:00:00Z`);
    return { jaar: d.getUTCFullYear(), maand: d.getUTCMonth() };
  });

  const maanden = useMemo(() => {
    const eerste = { ...anker };
    const tweede =
      anker.maand === 11
        ? { jaar: anker.jaar + 1, maand: 0 }
        : { jaar: anker.jaar, maand: anker.maand + 1 };
    return [eerste, tweede];
  }, [anker]);

  const schuif = (richting: -1 | 1) =>
    setAnker((a) => {
      const m = a.maand + richting;
      if (m < 0) return { jaar: a.jaar - 1, maand: 11 };
      if (m > 11) return { jaar: a.jaar + 1, maand: 0 };
      return { jaar: a.jaar, maand: m };
    });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={() => schuif(-1)}
          aria-label="Vorige maand"
          className="rounded-lg p-1 text-ink-mute transition hover:bg-sunk hover:text-ink"
        >
          <ChevronLeft size={16} strokeWidth={2.2} />
        </button>
        <div className="flex flex-1 justify-around text-[12.5px] font-semibold text-ink">
          {maanden.map((m) => (
            <span key={`${m.jaar}-${m.maand}`}>
              {MAANDEN[m.maand]} {m.jaar}
            </span>
          ))}
        </div>
        <button
          onClick={() => schuif(1)}
          aria-label="Volgende maand"
          className="rounded-lg p-1 text-ink-mute transition hover:bg-sunk hover:text-ink"
        >
          <ChevronRight size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {maanden.map((m) => (
          <MaandRooster
            key={`${m.jaar}-${m.maand}`}
            jaar={m.jaar}
            maand={m.maand}
            from={from}
            to={to}
            kiest={kiest}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function MaandRooster({
  jaar,
  maand,
  from,
  to,
  kiest,
  onPick,
}: {
  jaar: number;
  maand: number;
  from: string;
  to: string;
  kiest: 'from' | 'to';
  onPick: (d: string) => void;
}) {
  const eersteDag = new Date(Date.UTC(jaar, maand, 1));
  // Maandag als eerste kolom: getUTCDay() geeft 0 voor zondag.
  const offset = (eersteDag.getUTCDay() + 6) % 7;
  const aantal = new Date(Date.UTC(jaar, maand + 1, 0)).getUTCDate();
  const vandaag = today();

  const cellen: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: aantal }, (_, i) =>
      `${jaar}-${String(maand + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
    ),
  ];

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DAGEN.map((d) => (
          <span key={d} className="py-1 text-center text-[10px] font-semibold text-ink-faint">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cellen.map((d, i) => {
          if (!d) return <span key={`leeg${i}`} />;
          const inBereik = d >= from && d <= to;
          const isRand = d === from || d === to;
          const toekomst = d > vandaag;
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              disabled={toekomst}
              aria-current={isRand ? 'date' : undefined}
              className={cn(
                'h-7 rounded-md text-[11.5px] tabular-nums transition',
                toekomst && 'cursor-not-allowed text-ink-faint/40',
                !toekomst && isRand && 'bg-accent font-bold text-white',
                !toekomst && !isRand && inBereik && 'bg-accent-soft text-accent',
                !toekomst && !isRand && !inBereik && 'text-ink-soft hover:bg-sunk',
                // De volgende klik wordt de einddatum: laat dat zien in de hover.
                !toekomst && kiest === 'to' && d > from && !inBereik && 'hover:bg-accent-soft hover:text-accent',
              )}
            >
              {Number(d.split('-')[2])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
