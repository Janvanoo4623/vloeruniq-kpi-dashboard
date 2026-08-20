'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './index';

/**
 * Paginering onder een tabel. Toont bewust ook het bereik ("21–40 van 126"):
 * zonder dat getal weet je niet of je nog wat mist, en dan blijf je klikken.
 */
export function Pagination({
  page,
  pageCount,
  total,
  perPage,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const van = page * perPage + 1;
  const tot = Math.min(total, (page + 1) * perPage);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-5 py-3">
      <span className="text-[11.5px] tabular-nums text-ink-faint">
        {van}–{tot} van {total}
      </span>
      <div className="flex items-center gap-1">
        <PagButton disabled={page === 0} onClick={() => onChange(page - 1)} label="Vorige">
          <ChevronLeft size={14} strokeWidth={2.2} />
        </PagButton>
        {Array.from({ length: pageCount }, (_, i) => i)
          .filter((i) => i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 1)
          .reduce<(number | 'gap')[]>((acc, i) => {
            const vorige = acc[acc.length - 1];
            if (typeof vorige === 'number' && i - vorige > 1) acc.push('gap');
            acc.push(i);
            return acc;
          }, [])
          .map((i, idx) =>
            i === 'gap' ? (
              <span key={`gap${idx}`} className="px-1 text-[12px] text-ink-faint">
                …
              </span>
            ) : (
              <button
                key={i}
                onClick={() => onChange(i)}
                aria-current={i === page ? 'page' : undefined}
                className={cn(
                  'min-w-[26px] rounded-md px-1.5 py-1 text-[12px] font-medium tabular-nums transition',
                  i === page ? 'bg-ink text-white' : 'text-ink-mute hover:bg-sunk hover:text-ink',
                )}
              >
                {i + 1}
              </button>
            ),
          )}
        <PagButton disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)} label="Volgende">
          <ChevronRight size={14} strokeWidth={2.2} />
        </PagButton>
      </div>
    </div>
  );
}

function PagButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md p-1 text-ink-mute transition hover:bg-sunk hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
