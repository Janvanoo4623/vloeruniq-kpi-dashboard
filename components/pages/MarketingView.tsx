'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import ChartCard from '@/components/ChartCard';
import AdsWeekChart from '@/components/charts/AdsWeekChart';
import AdsCampaignTable from '@/components/AdsCampaignTable';
import AdsBudgetPanel from '@/components/AdsBudgetPanel';
import EmptyState from '@/components/pages/EmptyState';
import { Panel, SectionLabel } from '@/components/ui';
import { formatDateTime, formatEuro, formatNumber, formatPercent, timeAgo } from '@/lib/format';
import { deltaPct, googleLeadStats, marginAfterAds } from '@/lib/ads';
import type { AdsPayload } from '@/lib/ads-payload';

const DAY = 86400000;

/**
 * Wat Google Ads kost, wat het oplevert, en wat er van de marge overblijft.
 *
 * Drie bronnen, bewust uit elkaar gehouden: de kosten en klikken komen van
 * Google, de omzet en de marge uit Teamleader (leadbron "Google"), en het
 * budget is een afspraak die je hier zelf vastlegt. De rekensom onderaan
 * trekt de kosten van de marge af — dat is het getal waar het om gaat.
 */
export default function MarketingView({ initial }: { initial: AdsPayload }) {
  const { snap, comparison, range } = useDashboard();
  // Per periode één opgehaald resultaat; de eerste weergave komt van de server.
  // Geen setState in de effect zelf en geen losse laad-vlag: welke payload we
  // tonen én of er nog iets onderweg is, volgt uit de periode plus wat er het
  // laatst voor die periode is opgehaald.
  const [fetched, setFetched] = useState<{ key: string; payload: AdsPayload | null; fout: string | null } | null>(null);
  // Loopt op na een budgetwijziging, zodat dezelfde periode opnieuw wordt opgehaald.
  const [versie, setVersie] = useState(0);

  const key = `${range.from}|${range.to}|${range.compare}`;
  const isInitial =
    range.from === initial.range.from && range.to === initial.range.to && range.compare === 'none';
  const moetOphalen = !isInitial || versie > 0;
  const ads: AdsPayload = fetched?.key === key && fetched.payload ? fetched.payload : initial;
  const laden = moetOphalen && fetched?.key !== key;
  const fout = fetched?.key === key ? fetched.fout : null;

  // Daarna volgt deze pagina de periodekiezer in de kop, net als elk tabblad.
  // De setState zit in de then-callback, niet in de effect zelf.
  useEffect(() => {
    if (!moetOphalen) return;
    let verlopen = false;
    fetch(`/api/ads?from=${range.from}&to=${range.to}&compare=${range.compare}`)
      .then(async (res) => {
        const data = await res.json();
        if (verlopen) return;
        if (!res.ok || !data.ok) {
          setFetched({ key, payload: null, fout: data.error || 'Marketingcijfers laden mislukt.' });
        } else {
          setFetched({ key, payload: data as AdsPayload, fout: null });
        }
      })
      .catch(() => {
        if (!verlopen) setFetched({ key, payload: null, fout: 'Marketingcijfers laden mislukt (netwerk).' });
      });
    return () => {
      verlopen = true;
    };
  }, [moetOphalen, key, versie, range.from, range.to, range.compare]);

  const herladen = useCallback(() => setVersie((v) => v + 1), []);

  const totals = snap?.revenue.totals;
  const google = useMemo(
    () => (snap ? googleLeadStats(snap.quotations, snap.runTimeRows) : null),
    [snap],
  );

  if (!snap || !totals || !google) return <EmptyState />;

  if (!ads.available) {
    return (
      <Panel title="Google Ads nog niet gekoppeld" subtitle="De tabel voor de advertentiecijfers bestaat nog niet">
        <p className="max-w-[68ch] text-[13px] leading-relaxed text-ink-soft">
          Draai eerst <code className="rounded bg-sunk px-1">supabase/schema.sql</code> in de Supabase SQL editor
          (veilig om opnieuw te draaien), en haal daarna de cijfers op met{' '}
          <code className="rounded bg-sunk px-1">npm run sync:ads</code>. Zie docs/DATA-MODEL.md, &ldquo;Marketing&rdquo;.
        </p>
      </Panel>
    );
  }

  const a = ads.totals;
  const v = ads.comparison?.totals ?? null;
  const rekensom = marginAfterAds(totals.totalMargin, a, google);
  const vorigeNet =
    v && comparison ? comparison.revenue.totalMargin - v.cost : null;

  // Data-dekking: staat er wel iets voor de gekozen periode, en tot wanneer?
  const dataTot = ads.meta?.toDate ?? null;
  const achter = dataTot ? Math.round((Date.parse(range.to) - Date.parse(dataTot)) / DAY) : null;
  const geenData = a.activeDays === 0;

  return (
    <div className="space-y-6">
      {fout && (
        <p className="rounded-xl border border-crit/25 bg-crit-soft px-3.5 py-2.5 text-[12.5px] text-crit">{fout}</p>
      )}

      {(geenData || (achter != null && achter > 2)) && (
        <p className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn">
          <AlertTriangle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          <span>
            {geenData
              ? 'Geen advertentiecijfers voor deze periode. '
              : `De advertentiecijfers lopen tot en met ${dataTot}, ${achter} dagen achter op de gekozen periode. `}
            Haal ze op met <code className="rounded bg-white/60 px-1">npm run sync:ads</code>
            {ads.meta?.lastSyncAt ? ` — laatste import ${timeAgo(ads.meta.lastSyncAt)}.` : '.'}
          </span>
        </p>
      )}

      <section className={laden ? 'opacity-60 transition' : 'transition'}>
        <SectionLabel>Google Ads — deze periode</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Kosten"
            value={formatEuro(a.cost)}
            sub={`${formatNumber(a.impressions)} vertoningen`}
            deltaPct={deltaPct(a.cost, v?.cost)}
            higherIsBetter={false}
          />
          <KpiCard
            label="Klikken"
            value={formatNumber(a.clicks)}
            sub={a.activeDays > 0 ? `${formatNumber(Math.round(a.clicks / a.activeDays))} per dag` : undefined}
            deltaPct={deltaPct(a.clicks, v?.clicks)}
          />
          <KpiCard
            label="CTR"
            value={formatPercent(a.ctr)}
            sub="klikken per vertoning"
            deltaPct={deltaPct(a.ctr, v?.ctr)}
          />
          <KpiCard
            label="CPC"
            value={formatEuro(a.cpc, true)}
            sub="kosten per klik"
            deltaPct={deltaPct(a.cpc, v?.cpc)}
            higherIsBetter={false}
          />
          <KpiCard
            label="Conversies"
            value={formatNumber(Math.round(a.conversions * 10) / 10)}
            sub="volgens Google: formulier of telefoontje"
            deltaPct={deltaPct(a.conversions, v?.conversions)}
          />
          <KpiCard
            label="Per conversie"
            value={formatEuro(a.cpa)}
            sub="kosten per conversie"
            deltaPct={deltaPct(a.cpa, v?.cpa)}
            higherIsBetter={false}
          />
        </div>
      </section>

      <section>
        <SectionLabel>Wat het oplevert — uit Teamleader, leadbron “Google”</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Omzet uit Google-leads"
            value={formatEuro(google.revenue)}
            sub={`${google.count} gewonnen ${google.count === 1 ? 'offerte' : 'offertes'}${rekensom.roas != null ? ` · ${formatNumber(Math.round(rekensom.roas * 10) / 10).replace('.', ',')}× de kosten` : ''}`}
          />
          <KpiCard
            label="Marge uit Google-leads"
            value={formatEuro(google.margin)}
            sub={
              google.unpricedCount > 0
                ? `${google.unpricedCount} zonder inkoopprijs tellen niet mee`
                : google.marginRevenue > 0
                  ? `${formatPercent((google.margin / google.marginRevenue) * 100)} van de omzet`
                  : 'geen gewonnen offertes met marge'
            }
          />
          <KpiCard
            label="Kosten per gewonnen deal"
            value={formatEuro(rekensom.costPerWonDeal)}
            sub="advertentiekosten gedeeld door gewonnen Google-offertes"
            higherIsBetter={false}
          />
          <KpiCard
            label="Rendement Google Ads"
            value={formatEuro(rekensom.googleNet)}
            sub="marge uit Google-leads min de advertentiekosten"
            signal={rekensom.googleNet < 0 ? 'crit' : a.cost > 0 ? 'good' : undefined}
          />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Google telt een conversie op het moment van het formulier of telefoontje; Teamleader telt een
          gewonnen offerte op de beslisdatum. Die twee vallen zelden in dezelfde periode, dus vergelijk ze
          over langere periodes. Een deal met meerdere leadbronnen (“Google, Mond op mond”) telt hier mee,
          net als op Leadbronnen.
        </p>
      </section>

      <Panel
        title="Marge na marketing"
        subtitle="De totale marge van de periode, min wat Google Ads in diezelfde periode kostte"
      >
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1.2fr]">
          <Som label="Totale marge" waarde={formatEuro(totals.totalMargin)} sub={`${formatPercent(totals.avgMarginPct)} gemiddeld`} />
          <Teken>−</Teken>
          <Som label="Google Ads" waarde={formatEuro(a.cost)} sub={rekensom.costShareOfMargin != null ? `${formatPercent(rekensom.costShareOfMargin)} van de marge` : undefined} />
          <Teken>=</Teken>
          <Som
            label="Marge na Google Ads"
            waarde={formatEuro(rekensom.net)}
            sub={
              vorigeNet != null && ads.comparison
                ? `vorige periode ${formatEuro(vorigeNet)}`
                : totals.acceptedRevenue > 0
                  ? `${formatPercent((rekensom.net / totals.acceptedRevenue) * 100)} van de geaccepteerde omzet`
                  : undefined
            }
            accent={rekensom.net < 0 ? 'crit' : 'good'}
            deltaPct={vorigeNet != null ? deltaPct(rekensom.net, vorigeNet) : null}
          />
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Marge is omzet min inkoop, ondervloer en arbeid van de vloerregels, zoals op Marge. Andere
          marketingkosten (social, drukwerk) zitten hier niet in; alleen wat Google Ads factureert.
        </p>
      </Panel>

      <ChartCard title="Kosten en conversies per week" subtitle="Wat er per week is uitgegeven en hoeveel conversies Google daarvoor telde">
        <AdsWeekChart data={ads.byWeek} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ChartCard
          title="Maandbudget"
          subtitle="Afgesproken bedrag tegenover de werkelijke uitgaven; de lopende maand doorgetrokken op het huidige tempo"
          className="xl:col-span-2"
        >
          <AdsBudgetPanel months={ads.budgets} budgets={ads.rawBudgets} onSaved={herladen} />
        </ChartCard>
        <ChartCard title="Per campagne" subtitle="Waar het geld naartoe gaat en wat elke campagne daarvoor doet" className="xl:col-span-3">
          <AdsCampaignTable rows={ads.byCampaign} />
        </ChartCard>
      </div>

      <p className="text-[11.5px] text-ink-faint">
        Google Ads-cijfers{ads.meta?.fromDate ? ` van ${ads.meta.fromDate} t/m ${ads.meta.toDate}` : ''}, laatst
        opgehaald {ads.meta?.lastSyncAt ? timeAgo(ads.meta.lastSyncAt) : 'nooit'}
        {ads.meta?.lastSyncAt ? ` (${formatDateTime(ads.meta.lastSyncAt)})` : ''}. Bedragen zoals Google ze
        rapporteert, ex btw. Google corrigeert cijfers soms achteraf; elke import haalt daarom de laatste 90 dagen
        opnieuw op.
      </p>
    </div>
  );
}

function Som({
  label,
  waarde,
  sub,
  accent,
  deltaPct: d,
}: {
  label: string;
  waarde: string;
  sub?: string;
  accent?: 'good' | 'crit';
  deltaPct?: number | null;
}) {
  return (
    <KpiCard
      label={label}
      value={waarde}
      sub={sub}
      signal={accent}
      deltaPct={d}
      deltaLabel="vs vorige periode"
    />
  );
}

function Teken({ children }: { children: string }) {
  return (
    <span className="hidden text-center text-[22px] font-semibold text-ink-faint sm:block" aria-hidden>
      {children}
    </span>
  );
}
