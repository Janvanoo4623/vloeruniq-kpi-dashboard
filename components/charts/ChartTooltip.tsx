'use client';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labelFormat,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  format?: (value: number, key: string) => string;
  labelFormat?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-line bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1.5 font-medium text-ink-soft">
        {labelFormat && label != null ? labelFormat(label) : label}
      </div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-ink-mute">{p.name}</span>
          <span className="ml-auto pl-4 font-medium text-ink">
            {p.value != null && format ? format(p.value, String(p.dataKey)) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
