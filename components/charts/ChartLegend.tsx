'use client';

/**
 * Eigen legenda in plaats van die van Recharts. Twee redenen: de standaard staat
 * ónder de grafiek (waar je hem pas leest als je de kleuren al hebt moeten raden)
 * en hij gebruikt zijn eigen typografie. Deze staat erboven, in de huistypografie,
 * en bewaart de ruimte onder de assen voor de as zelf.
 */
export function ChartLegend({
  items,
  right,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-mute">
            {it.dashed ? (
              <span
                className="inline-block h-[2px] w-3.5 shrink-0 rounded-full"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 7px)`,
                }}
              />
            ) : (
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: it.color }}
              />
            )}
            {it.label}
          </li>
        ))}
      </ul>
      {right}
    </div>
  );
}
