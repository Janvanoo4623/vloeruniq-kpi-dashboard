'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import AdsWeekChart from '@/components/charts/AdsWeekChart';
import AdsCampaignTable from '@/components/AdsCampaignTable';
import AdsBudgetPanel from '@/components/AdsBudgetPanel';
import AdsFunnel from '@/components/AdsFunnel';
import AdsHero, { PLATFORM_COLOR, type PlatformReturn } from '@/components/AdsHero';
import EmptyState from '@/components/pages/EmptyState';
import { Panel, cn } from '@/components/ui';
import { formatDateTime, formatEuro, formatNumber, formatPercent, timeAgo } from '@/lib/format';
import { googleLeadsByWeek, leadStats, PLATFORM_LABEL, PLATFORM_SOURCE_LABEL, type AdsPlatform } from '@/lib/ads';
import { PLATFORMS, type AdsPayload } from '@/lib/ads-payload';

const DAY = 86400000;
type Tab = 'alles' | AdsPlatform;

/**
 * Wat de advertenties kosten, wat ze opleveren, en wat er van de marge
 * overblijft — Google Ads en Meta Ads.
 *
 * Bovenaan altijd de rekensom over álle kanalen: dat is het getal waar het om
 * gaat. Daaronder kies je: "Alles" zet de kanalen naast elkaar, een kanaal
 * toont zijn trechter, weekverloop, budget en campagnes. Kosten en klikken
 * komen van het platform, omzet en marge uit Teamleader (leadbron), het budget
 * is een afspraak die je hier zelf vastlegt.
 */
export default function MarketingView({ initial }: { initial: AdsPayload }) {
  const { snap, comparison, range, refreshCount } = useDashboard();
  const [tab, setTab] = useState<Tab>('alles');
  const [fetched, setFetched] = useState<{ key: string; payload: AdsPayload | null; fout: string | null } | null>(null);
  const [versie, setVersie] = useState(0);

  const key = `${range.from}|${range.to}|${range.compare}`;
  const isInitial =
    range.from === initial.range.from && range.to === initial.range.to && range.compare === 'none';
  const moetOphalen = !isInitial || versie > 0 || refreshCount > 0;
  const ads: AdsPayload = fetched?.key === key && fetched.payload ? fetched.payload : initial;
  const laden = moetOphalen && fetched?.key !== key;
  const fout = fetched?.key === key ? fetched.fout : null;

  useEffect(() => {
    if (!moetOphalen) return;
    let verlopen = false;
    fetch(`/api/ads?from=${range.from}&to=${range.to}&compare=${range.compare}`)
      .then(async (res) => {
        const data = await res.json();
        if (verlopen) return;
        if (!res.ok || !data.ok) setFetched({ key, payload: null, fout: data.error || 'Marketingcijfers laden mislukt.' });
        else setFetched({ key, payload: data as AdsPayload, fout: null });
      })
      .catch(() => {
        if (!verlopen) setFetched({ key, payload: null, fout: 'Marketingcijfers laden mislukt (netwerk).' });
      });
    return () => {
      verlopen = true;
    };
  }, [moetOphalen, key, versie, refreshCount, range.from, range.to, range.compare]);

  const herladen = useCallback(() => setVersie((v) => v + 1), []);

  const leads = useMemo(
    () =>
      snap
        ? { google: leadStats(snap.quotations, snap.runTimeRows, 'google'), meta: leadStats(snap.quotations, snap.runTimeRows, 'meta') }
        : null,
    [snap],
  );

  const totals = snap?.revenue.totals;
  if (!snap || !totals || !leads) return <EmptyState />;

  if (!ads.available) {
    return (
      <Panel title="Advertenties nog niet gekoppeld" subtitle="De tabel voor de advertentiecijfers bestaat nog niet">
        <p className="max-w-[68ch] text-[13px] leading-relaxed text-ink-soft">
          Draai eerst <code className="rounded bg-sunk px-1">supabase/schema.sql</code> in de Supabase SQL editor
          (veilig om opnieuw te draaien). Zie docs/DATA-MODEL.md, &ldquo;Marketing&rdquo;.
        </p>
      </Panel>
    );
  }

  const connected = PLATFORMS.filter((p) => ads.platforms[p].connected);
  const deltaLabel = range.compare === 'year' ? 'vs vorig jaar' : 'vs vorige periode';
  const heroPlatforms: PlatformReturn[] = connected.map((p) => ({
    platform: p,
    cost: ads.platforms[p].totals.cost,
    leads: leads[p],
  }));
  const prevNet =
    comparison && ads.total.prevTotals ? comparison.revenue.totalMargin - ads.total.prevTotals.cost : null;

  // Loopt een gekoppeld platform achter op de gekozen periode?
  const achterstanden = connected
    .map((p) => {
      const tot = ads.platforms[p].sync?.toDate ?? null;
      const dagen = tot ? Math.round((Date.parse(range.to) - Date.parse(tot)) / DAY) : null;
      return { p, tot, dagen, fout: ads.platforms[p].sync?.error ?? null };
    })
    .filter((x) => x.fout || (x.dagen != null && x.dagen > 2));

  return (
    <div className="space-y-6">
      {fout && <p className="rounded-xl border border-crit/25 bg-crit-soft px-3.5 py-2.5 text-[12.5px] text-crit">{fout}</p>}

      {achterstanden.map((x) => (
        <p
          key={x.p}
          className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn"
        >
          <AlertTriangle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          <span>
            {PLATFORM_LABEL[x.p]}:{' '}
            {x.fout
              ? `de laatste verversing mislukte (${x.fout}).`
              : `cijfers lopen tot en met ${x.tot}, ${x.dagen} dagen achter op de gekozen periode.`}{' '}
            Druk op Vernieuwen om bij te werken.
          </span>
        </p>
      ))}

      <div className={cn(laden && 'opacity-60 transition')}>
        <AdsHero totalMargin={totals.totalMargin} platforms={heroPlatforms} prevNet={prevNet} deltaLabel={deltaLabel} />
      </div>

      {/* Kanaalkeuze */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line bg-surface p-1 shadow-sm">
          {(['alles', ...PLATFORMS] as Tab[]).map((t) => {
            const actief = tab === t;
            const niet = t !== 'alles' && !ads.platforms[t].connected;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition',
                  actief ? 'bg-ink text-white' : 'text-ink-mute hover:text-ink',
                )}
              >
                {t !== 'alles' && <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: PLATFORM_COLOR[t] }} />}
                {t === 'alles' ? 'Alle kanalen' : PLATFORM_LABEL[t]}
                {niet && <span className={cn('text-[11px]', actief ? 'text-white/60' : 'text-ink-faint')}>niet gekoppeld</span>}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'alles' ? (
        <AllesView ads={ads} leads={leads} connected={connected} onSaved={herladen} />
      ) : !ads.platforms[tab].connected ? (
        <NietGekoppeld platform={tab} />
      ) : (
        <KanaalView
          platform={tab}
          ads={ads}
          leads={leads[tab]}
          leadWeeks={googleLeadsByWeek(snap.quotations, snap.runTimeRows, ads.platforms[tab].byWeek.map((w) => w.week), tab)}
          deltaLabel={deltaLabel}
          onSaved={herladen}
        />
      )}

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        {connected.map((p) => {
          const s = ads.platforms[p].sync;
          return (
            <span key={p} className="mr-3 inline-block">
              {PLATFORM_LABEL[p]}
              {s?.fromDate ? ` ${s.fromDate} t/m ${s.toDate}` : ''}, opgehaald {s?.lastSyncAt ? timeAgo(s.lastSyncAt) : 'nooit'}
              {s?.lastSyncAt ? ` (${formatDateTime(s.lastSyncAt)})` : ''}.
            </span>
          );
        })}
        Bedragen zoals de platforms ze rapporteren, ex btw. Elke verversing haalt de laatste 90 dagen opnieuw op, omdat
        platforms cijfers achteraf corrigeren.
      </p>
    </div>
  );
}

type LeadsByPlatform = Record<AdsPlatform, ReturnType<typeof leadStats>>;

/** Alle kanalen naast elkaar: één regel per kanaal, zelfde kolommen, plus het totaal. */
function AllesView({
  ads,
  leads,
  connected,
  onSaved,
}: {
  ads: AdsPayload;
  leads: LeadsByPlatform;
  connected: AdsPlatform[];
  onSaved: () => void;
}) {
  const rijen = connected.map((p) => {
    const t = ads.platforms[p].totals;
    const l = leads[p];
    return { key: p, label: PLATFORM_LABEL[p], color: PLATFORM_COLOR[p], t, l, rendement: l.margin - t.cost };
  });
  const tt = ads.total.totals;
  const lt = connected.reduce(
    (a, p) => ({ count: a.count + leads[p].count, revenue: a.revenue + leads[p].revenue, margin: a.margin + leads[p].margin }),
    { count: 0, revenue: 0, margin: 0 },
  );
  const alleCampagnes = connected
    .flatMap((p) => ads.platforms[p].byCampaign)
    .sort((a, b) => b.cost - a.cost)
    .map((c) => ({ ...c, costShare: tt.cost > 0 ? Math.round((c.cost / tt.cost) * 1000) / 10 : null }));

  return (
    <div className="space-y-6">
      <ChartCard title="Kanalen naast elkaar" subtitle="Wat elk kanaal kost en wat het opleverde in deze periode — kosten ex btw, omzet en marge uit Teamleader">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left font-medium">Kanaal</th>
                <th className="px-3 py-2 text-right font-medium">Kosten</th>
                <th className="px-3 py-2 text-right font-medium">Klikken</th>
                <th className="px-3 py-2 text-right font-medium">CTR</th>
                <th className="px-3 py-2 text-right font-medium">CPC</th>
                <th className="px-3 py-2 text-right font-medium">Conversies</th>
                <th className="px-3 py-2 text-right font-medium">Per conversie</th>
                <th className="px-3 py-2 text-right font-medium">Gewonnen</th>
                <th className="px-3 py-2 text-right font-medium">Omzet</th>
                <th className="px-3 py-2 text-right font-medium">Rendement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {rijen.map((r) => (
                <tr key={r.key} className="hover:bg-sunk">
                  <td className="px-3 py-2.5 text-ink">
                    <span className="flex items-center gap-2">
                      <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: r.color }} />
                      {r.label}
                    </span>
                    <span className="text-[11px] text-ink-faint">leadbron “{PLATFORM_SOURCE_LABEL[r.key]}”</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatEuro(r.t.cost)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatNumber(r.t.clicks)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatPercent(r.t.ctr)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatEuro(r.t.cpc, true)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatNumber(Math.round(r.t.conversions))}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatEuro(r.t.cpa)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatNumber(r.l.count)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatEuro(r.l.revenue)}</td>
                  <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', r.rendement >= 0 ? 'text-good' : 'text-crit')}>
                    {formatEuro(r.rendement)}
                  </td>
                </tr>
              ))}
              {rijen.length > 1 && (
                <tr className="bg-sunk/50 font-semibold">
                  <td className="px-3 py-2.5 text-ink">Totaal</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatEuro(tt.cost)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatNumber(tt.clicks)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatPercent(tt.ctr)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatEuro(tt.cpc, true)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatNumber(Math.round(tt.conversions))}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatEuro(tt.cpa)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatNumber(lt.count)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatEuro(lt.revenue)}</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', lt.margin - tt.cost >= 0 ? 'text-good' : 'text-crit')}>
                    {formatEuro(lt.margin - tt.cost)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Conversies tellen per platform anders: Google telt alle conversieacties, Meta leads, berichten en contact. Vergelijk
          daarom vooral kosten, gewonnen offertes en rendement. Een deal met twee leadbronnen telt bij beide kanalen mee.
        </p>
      </ChartCard>

      <ChartCard title="Kosten en conversies per week" subtitle="Alle kanalen samen">
        <AdsWeekChart data={ads.total.byWeek} conversionsLabel="Conversies (alle kanalen)" />
      </ChartCard>

      {connected.map((p) => (
        <ChartCard
          key={p}
          title={`Maandbudget ${PLATFORM_LABEL[p]}`}
          subtitle="Afgesproken bedrag tegenover de werkelijke uitgaven; de lopende maand doorgetrokken op het huidige tempo"
        >
          <AdsBudgetPanel platform={p} months={ads.platforms[p].budgets} budgets={ads.platforms[p].rawBudgets} onSaved={onSaved} />
        </ChartCard>
      ))}

      <ChartCard title="Alle campagnes" subtitle="Van beide kanalen, gesorteerd op kosten">
        <AdsCampaignTable rows={alleCampagnes} showPlatform conversionsLabel="Conversies" />
      </ChartCard>
    </div>
  );
}

function KanaalView({
  platform,
  ads,
  leads,
  leadWeeks,
  deltaLabel,
  onSaved,
}: {
  platform: AdsPlatform;
  ads: AdsPayload;
  leads: ReturnType<typeof leadStats>;
  leadWeeks: ReturnType<typeof googleLeadsByWeek>;
  deltaLabel: string;
  onSaved: () => void;
}) {
  const b = ads.platforms[platform];
  const convLabel = platform === 'meta' ? 'Conversies' : 'Alle conversies';
  return (
    <div className="space-y-6">
      <AdsFunnel platform={platform} ads={b.totals} prev={b.prevTotals} leads={leads} weeks={b.byWeek} leadWeeks={leadWeeks} deltaLabel={deltaLabel} />

      <ChartCard title="Kosten en conversies per week" subtitle={`${PLATFORM_LABEL[platform]}: uitgaven en ${convLabel.toLowerCase()} per week`}>
        <AdsWeekChart
          data={b.byWeek}
          conversionsLabel={convLabel}
          costColor={PLATFORM_COLOR[platform]}
          costGradient={platform === 'meta' ? 'gMetaCost' : 'gAdsCost'}
        />
      </ChartCard>

      <ChartCard
        title={`Maandbudget ${PLATFORM_LABEL[platform]}`}
        subtitle="Afgesproken bedrag tegenover de werkelijke uitgaven; de lopende maand doorgetrokken op het huidige tempo"
      >
        <AdsBudgetPanel platform={platform} months={b.budgets} budgets={b.rawBudgets} onSaved={onSaved} />
      </ChartCard>

      <ChartCard title="Per campagne" subtitle="Waar het geld naartoe gaat en wat elke campagne daarvoor doet">
        <AdsCampaignTable rows={b.byCampaign} conversionsLabel={convLabel} />
      </ChartCard>
    </div>
  );
}

/** Wat er nog moet gebeuren voordat een kanaal cijfers heeft. */
function NietGekoppeld({ platform }: { platform: AdsPlatform }) {
  if (platform === 'google') {
    return (
      <Panel title="Google Ads nog niet gekoppeld" subtitle="Er is nog geen GAQL-koppeling ingesteld">
        <p className="text-[13px] text-ink-soft">
          Zet de GAQL-URL in <code className="rounded bg-sunk px-1">.env.local</code> als GAQL_TOKEN en draai{' '}
          <code className="rounded bg-sunk px-1">npm run ads:token</code>.
        </p>
      </Panel>
    );
  }
  return (
    <Panel title="Meta Ads nog niet gekoppeld" subtitle="Alles staat klaar; alleen de toegang tot het advertentieaccount ontbreekt">
      <ol className="max-w-[72ch] list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
        <li>
          Jan geeft toegang tot het advertentieaccount van Vloeruniq in Meta Business Manager.
        </li>
        <li>
          In Business Manager, bij Gebruikers → Systeemgebruikers, een systeemgebruiker aanmaken, het advertentieaccount
          eraan toewijzen en een token genereren met het recht <code className="rounded bg-sunk px-1">ads_read</code>.
        </li>
        <li>
          Token en advertentie-account-ID in <code className="rounded bg-sunk px-1">.env.local</code> zetten als
          META_ACCESS_TOKEN en META_AD_ACCOUNT_ID.
        </li>
        <li>
          <code className="rounded bg-sunk px-1">npm run ads:meta-token</code> draaien. Dat test de koppeling, zet hem in de
          database en laadt de laatste 90 dagen. Daarna ververst Vernieuwen Meta vanzelf mee.
        </li>
      </ol>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-faint">
        <Link2 size={12} /> Omzet en marge komen uit Teamleader, via leadbron “Social media” op de deal.
      </p>
    </Panel>
  );
}
