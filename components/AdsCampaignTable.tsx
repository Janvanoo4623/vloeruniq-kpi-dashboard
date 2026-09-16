'use client';

import type { AdsCampaignStat } from '@/lib/ads';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { Badge } from './ui';
import { CHART } from './charts/theme';
import { Pagination, usePaged } from './ui/Pagination';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'warn' | 'good' }> = {
  ENABLED: { label: 'actief', tone: 'good' },
  PAUSED: { label: 'gepauzeerd', tone: 'neutral' },
  REMOVED: { label: 'verwijderd', tone: 'warn' },
};

/** Per campagne: wat hij kost en wat hij daarvoor doet. Gesorteerd op kosten. */
export default function AdsCampaignTable({ rows }: { rows: AdsCampaignStat[] }) {
  const gepagineerd = usePaged(rows);
  if (rows.length === 0) {
    return <div className="flex h-24 items-center justify-center text-sm text-ink-faint">Geen campagnes met uitgaven in deze periode</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-sunk text-xs text-ink-mute">
          <tr className="border-b border-line">
            <th className="px-3 py-2 text-left font-medium">Campagne</th>
            <th className="px-3 py-2 text-right font-medium">Kosten</th>
            <th className="px-3 py-2 text-left font-medium">Aandeel</th>
            <th className="px-3 py-2 text-right font-medium">Klikken</th>
            <th className="px-3 py-2 text-right font-medium">CTR</th>
            <th className="px-3 py-2 text-right font-medium">CPC</th>
            <th className="px-3 py-2 text-right font-medium">Alle conversies</th>
            <th className="px-3 py-2 text-right font-medium">Per conversie</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {gepagineerd.visible.map((c) => {
            const st = STATUS[c.status];
            return (
              <tr key={c.id} className="hover:bg-sunk">
                <td className="px-3 py-2 text-ink">
                  <div className="flex items-center gap-2">
                    <span className="truncate" title={c.name}>{c.name}</span>
                    {st && st.tone !== 'good' && <Badge tone={st.tone}>{st.label}</Badge>}
                  </div>
                  <div className="text-[11px] text-ink-faint">{c.channel.toLowerCase().replace('_', ' ')}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{formatEuro(c.cost)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-sunk">
                      <div className="h-full rounded-full" style={{ width: `${c.costShare ?? 0}%`, background: CHART.adsCost }} />
                    </div>
                    <span className="w-11 text-right text-[12px] tabular-nums text-ink-mute">{formatPercent(c.costShare)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatNumber(c.clicks)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatPercent(c.ctr)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatEuro(c.cpc, true)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatNumber(Math.round(c.conversions * 10) / 10)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatEuro(c.cpa)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination {...gepagineerd.props} />
    </div>
  );
}
