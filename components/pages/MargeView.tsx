'use client';

import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import ProductsTable from '@/components/ProductsTable';
import AttentionTable from '@/components/AttentionTable';
import EmptyState from '@/components/pages/EmptyState';
import InstallMixPanel from '@/components/pages/InstallMixPanel';
import { perM2Stats } from '@/lib/insights';
import type { InstallMixPoint, InstallModeStat, ProductSpread } from '@/lib/insights';
import ProductSpreadPanel from '@/components/pages/ProductSpreadPanel';
import InvoicedMarginPanel from '@/components/pages/InvoicedMarginPanel';
import PriceSensitivityPanel from '@/components/pages/PriceSensitivityPanel';
import type { PriceSensitivity } from '@/lib/price-sensitivity';
import { AlertTriangle, Factory, Layers, Receipt, Ruler, TrendingUp } from 'lucide-react';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart from '@/components/page/HighlightChart';
import { DetailsLabel, InsightCard, StatTile, type Insight } from '@/components/overview/cards';

/** Alles over marge op één plek: de curve, per product, en waar het misgaat. */
export default function MargeView({
  installTotals,
  installByQuarter,
  spread,
  sensitivity,
}: {
  installTotals: InstallModeStat[];
  installByQuarter: InstallMixPoint[];
  spread: ProductSpread[];
  sensitivity: PriceSensitivity;
}) {
  const { snap, pricedCodes, invoicedMargin, today } = useDashboard();
  const totals = snap?.revenue.totals;
  if (!snap || !totals) return <EmptyState />;

  // Alles per m² komt uit de vloerregels van de gekozen periode, niet uit de
  // snapshot-totalen: die deelden de héle offerte-omzet door alleen vloer-m².
  const perM2 = perM2Stats(snap.quotations);
  const dekking = perM2.m2Total > 0 ? (perM2.m2Priced / perM2.m2Total) * 100 : null;

  // Inzichten voor "In het kort": een prijsstap, de beste legwijze, en hoeveel
  // vloer nog zonder inkoopprijs is.
  const extraPerEuro = sensitivity.m2Total;
  const { cheaper, pricier } = sensitivity.winRate;
  const modi = installTotals.filter((t) => t.marginPct != null && t.m2 > 200).sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0));
  const besteModus = modi[0];
  const slechtsteModus = modi[modi.length - 1];
  const zonder = perM2.m2Total - perM2.m2Priced;
  const inzichten: Insight[] = [
    {
      Icon: TrendingUp,
      tone: 'brand',
      text: `**+€ 1 per m²** had de afgelopen twaalf maanden **${formatEuro(extraPerEuro)}** extra marge opgeleverd${
        cheaper != null && pricier != null
          ? pricier >= cheaper
            ? ` — en duurdere offertes worden niet minder vaak gewonnen (${formatPercent(pricier)} tegen ${formatPercent(cheaper)}).`
            : pricier >= cheaper - 3
            ? ` — en duurdere offertes worden nauwelijks minder vaak gewonnen (${formatPercent(pricier)} tegen ${formatPercent(cheaper)}).`
            : `, maar duurdere offertes worden minder vaak gewonnen (${formatPercent(pricier)} tegen ${formatPercent(cheaper)}).`
          : '.'
      }`,
    },
    ...(besteModus && slechtsteModus && besteModus !== slechtsteModus
      ? [
          {
            Icon: Layers,
            tone: 'neutral' as const,
            text: `${besteModus.label} levert **${formatPercent(besteModus.marginPct)}** marge op, ${slechtsteModus.label.toLowerCase()} **${formatPercent(slechtsteModus.marginPct)}**.`,
          },
        ]
      : []),
    ...(zonder > 0
      ? [
          {
            Icon: AlertTriangle,
            tone: 'warn' as const,
            text: `**${formatNumber(zonder)} m²** in deze periode heeft nog geen inkoopprijs en telt niet mee. Vul die aan op Controleren.`,
          },
        ]
      : []),
  ];
  const weken = today.bars.weeks;

  return (
    <div className="space-y-5">
      {/* 1. Kerngetal en duiding */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label="Marge per verkochte m²"
          status={dekking != null ? `${formatPercent(dekking)} van de m² beprijsd` : undefined}
          tone={dekking != null && dekking < 80 ? 'warn' : 'neutral'}
          value={perM2.marginPerM2 ?? 0}
          format={(v) => formatEuro(v, true)}
          sub={
            <>
              {formatEuro(perM2.revenuePerM2, true)} omzet − {formatEuro(perM2.costPerM2, true)} kostprijs per m² · vloerregels, ex btw
            </>
          }
          href="/controleren"
          hrefLabel="Ontbrekende inkoopprijzen aanvullen"
        >
          <MiniStat label="Totale marge" value={formatEuro(totals.totalMargin)} sub={`${formatPercent(totals.avgMarginPct)} van de omzet`} />
          <MiniStat label="Marge op de vloer" value={formatPercent(perM2.marginPct)} sub="van de vloeromzet" bar={perM2.marginPct != null ? perM2.marginPct / 100 : null} />
        </HeroCard>
        <InsightCard items={inzichten} />
      </div>

      {/* 2. Tegels */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={Receipt} label="Omzet per m²" value={formatEuro(perM2.revenuePerM2, true)} sub="wat de vloer opbrengt" />
        <StatTile
          Icon={Factory}
          label="Kostprijs per m²"
          value={formatEuro(perM2.costPerM2, true)}
          sub={`${formatEuro(perM2.purchasePerM2, true)} inkoop + ${formatEuro(perM2.underlayPerM2, true)} ondervloer + ${formatEuro(perM2.laborPerM2, true)} arbeid`}
        />
        <StatTile Icon={Ruler} label="Verkochte m²" value={formatNumber(perM2.m2Total)} sub={`${formatNumber(perM2.m2Priced)} met inkoopprijs`} bars={weken.filter((w) => !w.current).map((w) => w.m2)} />
        <StatTile
          Icon={AlertTriangle}
          label="Zonder inkoopprijs"
          href="/controleren"
          value={`${formatNumber(zonder)} m²`}
          sub={zonder > 0 ? 'telt niet mee in de marge — aanvullen op Controleren' : 'alles beprijsd'}
        />
      </div>

      {/* 3. Hoofdgrafiek */}
      <HighlightChart
        series={[
          {
            key: 'marge',
            label: 'Marge €',
            title: 'Marge per week · laatste 12 weken',
            fmt: (v) => formatEuro(v),
            points: weken.map((w) => ({ label: w.label, value: w.margin, current: w.current })),
          },
          {
            key: 'pct',
            label: 'Marge %',
            title: 'Marge % per week',
            fmt: (v) => formatPercent(v),
            total: (() => {
              const r = weken.filter((w) => !w.current).reduce((t, w) => t + w.revenue, 0);
              const m = weken.filter((w) => !w.current).reduce((t, w) => t + w.margin, 0);
              return r > 0 ? Math.round((m / r) * 1000) / 10 : 0;
            })(),
            sub: 'gemiddeld over de volle weken',
            points: weken.map((w) => ({ label: w.label, value: w.revenue > 0 ? Math.round((w.margin / w.revenue) * 1000) / 10 : 0, current: w.current })),
          },
        ]}
        footnote="De lopende week staat lichter: die is nog niet af"
      />

      {/* 4. Verdieping */}
      <DetailsLabel />

      <InvoicedMarginPanel data={invoicedMargin} quotationMargin={totals.totalMargin} pricedCodes={pricedCodes} />

      <InstallMixPanel totals={installTotals} byQuarter={installByQuarter} />

      <ChartCard title="Per vloerproduct" subtitle="Omzet, m² en marge per product">
        <ProductsTable rows={snap.topProducts} />
      </ChartCard>

      <ProductSpreadPanel products={spread} />

      <PriceSensitivityPanel data={sensitivity} />

      <ChartCard
        title="Aandachtspunten"
        subtitle="Waar je te weinig verdient, en waar de prijsdekking onvolledig is — ontbrekende inkoopprijzen staan op Controleren"
      >
        <AttentionTable rows={snap.quotations} pricedCodes={pricedCodes} />
      </ChartCard>
    </div>
  );
}
