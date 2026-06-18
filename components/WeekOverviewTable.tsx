'use client';

import { useState } from 'react';
import type { Snapshot } from '@/lib/types';
import {
  formatEuroCompact,
  formatNumber,
  formatPercent,
  formatDays,
  shortWeek,
} from '@/lib/format';

type Fmt = (v: number | null) => string;

interface Row {
  label: string;
  total: number | null;
  cell: (week: string) => number | null;
  fmt: Fmt;
}

interface Section {
  title: string;
  rows: Row[];
}

const DEFAULT_WEEKS = 8;

export default function WeekOverviewTable({ snapshot }: { snapshot: Snapshot }) {
  const [showAll, setShowAll] = useState(false);
  const allWeeks = snapshot.weeks; // descending (newest first)
  const weeks = showAll ? allWeeks : allWeeks.slice(0, DEFAULT_WEEKS);

  const rev = snapshot.revenue;
  const rt = snapshot.runTime;

  const euro: Fmt = (v) => formatEuroCompact(v);
  const int: Fmt = (v) => formatNumber(v);
  const pct: Fmt = (v) => formatPercent(v);
  const days: Fmt = (v) => formatDays(v);

  const wRev = (w: string) => rev.byWeek[w];
  const wRt = (w: string) => rt.byWeek[w];

  const sections: Section[] = [
    {
      title: 'Omzet',
      rows: [
        { label: 'Omzet geaccepteerd', total: rev.totals.acceptedRevenue, cell: (w) => wRev(w)?.acceptedRevenue ?? 0, fmt: euro },
        { label: 'Omzet open', total: rev.totals.openRevenue, cell: (w) => wRev(w)?.openRevenue ?? 0, fmt: euro },
        { label: '# Geaccepteerd', total: rev.totals.acceptedCount, cell: (w) => wRev(w)?.acceptedCount ?? 0, fmt: int },
        { label: '# Open', total: rev.totals.openCount, cell: (w) => wRev(w)?.openCount ?? 0, fmt: int },
        {
          label: 'Gem. omzet / deal',
          total: rev.totals.avgRevenuePerDeal,
          cell: (w) => {
            const d = wRev(w);
            return d && d.acceptedCount > 0 ? Math.round((d.acceptedRevenue / d.acceptedCount) * 100) / 100 : 0;
          },
          fmt: euro,
        },
        { label: 'M² verkocht', total: rev.totals.m2Sold, cell: (w) => wRev(w)?.acceptedM2 ?? 0, fmt: int },
        { label: 'Totale marge', total: rev.totals.totalMargin, cell: (w) => wRev(w)?.acceptedMargin ?? 0, fmt: euro },
        {
          label: 'Gem. marge',
          total: rev.totals.avgMarginPct,
          cell: (w) => {
            const d = wRev(w);
            return d && d.acceptedMarginRev > 0 ? Math.round((d.acceptedMargin / d.acceptedMarginRev) * 1000) / 10 : null;
          },
          fmt: pct,
        },
      ],
    },
    {
      title: 'Doorlooptijd',
      rows: [
        {
          label: 'Gem. doorlooptijd',
          total: rt.totals.avgRunTimeDays,
          cell: (w) => {
            const d = wRt(w);
            return d && d.count > 0 ? Math.round((d.totalDays / d.count) * 10) / 10 : null;
          },
          fmt: days,
        },
      ],
    },
  ];

  // Frozen columns: KPI label (left-0) + Totaal (left-44). Same colours/sizing as the offer table.
  const labelCell = 'sticky left-0 z-20 w-44 min-w-44 bg-white px-3 py-2 text-left';
  const totalCell =
    'sticky left-44 z-20 bg-white px-3 py-2 text-right tabular-nums font-medium text-neutral-800 border-r border-neutral-200';
  const weekCell = 'whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-500';

  return (
    <div>
      {/* control row — same height/spacing as the offer table's filter row */}
      <div className="mb-3 flex items-center justify-end gap-2">
        {allWeeks.length > DEFAULT_WEEKS && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-500 transition hover:text-neutral-900"
          >
            {showAll ? `Laatste ${DEFAULT_WEEKS} weken` : `Alle ${allWeeks.length} weken`}
          </button>
        )}
        <span className="text-xs text-neutral-400">{weeks.length} weken</span>
      </div>

      <div className="h-[460px] overflow-auto rounded-xl border border-neutral-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-30 bg-neutral-50 text-xs text-neutral-500">
            <tr className="border-b border-neutral-200">
              <th className={`${labelCell} z-40 bg-neutral-50 font-medium`}>KPI</th>
              <th className="sticky left-44 z-40 border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-right font-medium text-neutral-700">
                Totaal
              </th>
              {weeks.map((w) => (
                <th key={w} className="px-3 py-2 text-right font-medium">
                  {shortWeek(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <SectionRows
                key={section.title}
                section={section}
                weeks={weeks}
                labelCell={labelCell}
                totalCell={totalCell}
                weekCell={weekCell}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  section,
  weeks,
  labelCell,
  totalCell,
  weekCell,
}: {
  section: Section;
  weeks: string[];
  labelCell: string;
  totalCell: string;
  weekCell: string;
}) {
  return (
    <>
      <tr className="bg-neutral-50">
        <td
          colSpan={weeks.length + 2}
          className="sticky left-0 z-10 bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400"
        >
          {section.title}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.label} className="group border-t border-neutral-100 hover:bg-neutral-50">
          <td className={`${labelCell} font-medium text-neutral-800 group-hover:bg-neutral-50`}>
            {row.label}
          </td>
          <td className={`${totalCell} group-hover:bg-neutral-50`}>{row.fmt(row.total)}</td>
          {weeks.map((w) => (
            <td key={w} className={weekCell}>
              {row.fmt(row.cell(w))}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
