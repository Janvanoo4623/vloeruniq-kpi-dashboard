'use client';

import { Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { NieuwbouwOverview } from '@/lib/nieuwbouw';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { Empty, Panel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';

const kwartaal = (p: string) => p.replace('-K', ' kw ');

/**
 * Vergunde nieuwbouwwoningen per gemeente, naast de eigen omzet daar.
 *
 * Waarom dit naast het marktaandeel staat en niet erin: verhuizingen zijn de
 * vraag van nu, een vergunning is de vraag van over anderhalf tot twee jaar.
 * Twee verschillende horizonnen door elkaar halen levert een getal op dat geen
 * van beide vragen beantwoordt.
 *
 * Een gemeente met veel vergunningen en weinig eigen omzet is een advertentie-
 * of netwerkbeslissing; een gemeente waar de vergunningen inzakken terwijl er
 * veel omzet vandaan komt, is een waarschuwing voor volgend jaar.
 */
export default function NieuwbouwPanel({ data }: { data: NieuwbouwOverview }) {
  const { rows, permitsJaar, permitsVorigJaar, groeiPct, cbsThrough } = data;
  const zichtbaar = rows.filter((r) => r.permitsJaar > 0 || r.revenue > 0);
  const gepagineerd = usePaged(zichtbaar);

  if (!cbsThrough || zichtbaar.length === 0) {
    return (
      <Panel
        title="Nieuwbouw in het werkgebied"
        subtitle="Vergunde woningen per gemeente (CBS)"
      >
        <Empty>CBS-cijfers over bouwvergunningen zijn nu niet beschikbaar.</Empty>
      </Panel>
    );
  }

  const maxPermits = Math.max(1, ...zichtbaar.map((r) => r.permitsJaar));

  return (
    <Panel
      title="Nieuwbouw in het werkgebied"
      subtitle={`Vergunde woningen per gemeente, laatste vier kwartalen t/m ${kwartaal(cbsThrough)}`}
      right={
        <div className="text-right">
          <p className="text-[11px] leading-none text-ink-faint">Vergund, 12 maanden</p>
          <p className="mt-1 flex items-baseline justify-end gap-1.5">
            <span className="text-[17px] font-bold leading-none tabular-nums text-ink">
              {formatNumber(permitsJaar)}
            </span>
            {groeiPct != null && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
                  groeiPct >= 0 ? 'text-good' : 'text-crit',
                )}
              >
                {groeiPct >= 0 ? (
                  <TrendingUp size={10} strokeWidth={2.6} />
                ) : (
                  <TrendingDown size={10} strokeWidth={2.6} />
                )}
                {formatPercent(Math.abs(groeiPct))}
              </span>
            )}
          </p>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="flex items-start gap-2 border-b border-hair px-5 py-3">
        <Info size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-faint" />
        <p className="text-[12px] leading-relaxed text-ink-mute">
          Elke vergunde woning krijgt over anderhalf tot twee jaar een vloer. Dit is dus geen
          orderportefeuille maar een vooruitzicht: een gemeente met veel vergunningen en weinig
          eigen omzet is een reden om daar zichtbaar te worden. Vorig jaar dezelfde vier kwartalen:{' '}
          {formatNumber(permitsVorigJaar)} woningen.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="border-b border-hair text-[10.5px] uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-2 text-left font-semibold">Gemeente</th>
              <th className="px-3 py-2 text-right font-semibold">Vergund</th>
              <th className="px-3 py-2 text-left font-semibold">Verhouding</th>
              <th className="px-3 py-2 text-right font-semibold">Vorig jaar</th>
              <th className="px-5 py-2 text-right font-semibold">Eigen omzet</th>
            </tr>
          </thead>
          <tbody>
            {gepagineerd.visible.map((r) => (
              <tr key={r.code} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                <td className="px-5 py-2.5">
                  <span className="font-medium text-ink">{r.gemeente}</span>
                  {r.plaatsen.length > 0 && (
                    <span className="ml-2 text-[11px] text-ink-faint">
                      {r.plaatsen.slice(0, 3).join(', ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                  {formatNumber(r.permitsJaar)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="block h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-sunk">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(r.permitsJaar / maxPermits) * 100}%` }}
                    />
                  </span>
                </td>
                {/* Alleen het verschil krijgt kleur; het aantal van vorig jaar is
                    een feit, geen signaal. */}
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-mute">
                  {formatNumber(r.permitsVorigJaar)}
                  {r.groeiPct != null && (
                    <span
                      className={cn(
                        'ml-1 text-[11px] font-semibold',
                        r.groeiPct >= 0 ? 'text-good' : 'text-crit',
                      )}
                    >
                      {r.groeiPct >= 0 ? '+' : '−'}
                      {formatPercent(Math.abs(r.groeiPct))}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                  {r.revenue > 0 ? formatEuro(r.revenue) : <span className="text-ink-faint">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination {...gepagineerd.props} />
      </div>
    </Panel>
  );
}
