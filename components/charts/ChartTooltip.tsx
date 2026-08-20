'use client';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
  stroke?: string;
  fill?: string;
}

/**
 * De tooltip is het enige moment waarop iemand een exact getal afleest, dus die
 * krijgt de volle typografie: label bovenaan, waarden rechts uitgelijnd op
 * tabulaire cijfers zodat ze onder elkaar staan.
 *
 * `p.color` is bij een staaf met verloop de url(#gradient) — die kun je niet als
 * CSS-kleur gebruiken. Vandaar de terugval op stroke, en anders de puntkleur uit
 * de reeks meegeven via `dotColors`.
 */
const usableColor = (c?: string) => (c && !c.startsWith('url(') ? c : undefined);

export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labelFormat,
  dotColors,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  format?: (value: number, key: string) => string;
  labelFormat?: (label: string) => string;
  /** Kleur per dataKey, voor reeksen die met een verloop gevuld zijn. */
  dotColors?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[168px] rounded-xl border border-line bg-white/95 px-3 py-2.5 shadow-[0_8px_24px_-6px_rgba(28,25,23,0.18)] backdrop-blur">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        {labelFormat && label != null ? labelFormat(label) : label}
      </div>
      <div className="space-y-1">
        {payload.map((p, i) => {
          const key = String(p.dataKey ?? '');
          const dot =
            dotColors?.[key] ?? usableColor(p.stroke) ?? usableColor(p.color) ?? usableColor(p.fill);
          return (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: dot }}
              />
              <span className="text-ink-mute">{p.name}</span>
              <span className="ml-auto pl-4 font-semibold tabular-nums text-ink">
                {p.value != null && format ? format(p.value, key) : p.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
