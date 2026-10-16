'use client';

import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MarketData } from '@/lib/market';
import { formatEuro } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Empty, Panel, SectionLabel } from '@/components/ui';

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAAND_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const kort = (m: string) => `${MAAND[Number(m.slice(5, 7)) - 1]} ’${m.slice(2, 4)}`;
const lang = (m: string) => `${MAAND_LANG[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;

const KLEUR = { omzet: CHART.deals, koop: CHART.accepted, pvc: CHART.accepted, parket: CHART.open, lijm: CHART.adsCost };

/**
 * Twee vragen die het eigen dashboard niet kan beantwoorden: zit de klant in
 * een koopstemming, en gaat mijn inkoop duurder worden? Beide uit CBS, naast
 * de eigen cijfers gelegd. Het verband is geen voorspelling; het is context
 * die je anders uit de krant moet halen.
 */
export default function MarketPanel({ data }: { data: MarketData }) {
  const own = new Map(data.own.map((o) => [o.month, o]));
  const koop = data.confidence.map((c) => ({ ...c, revenue: own.get(c.month)?.revenue ?? null }));
  const laatsteKoop = [...data.confidence].reverse().find((c) => c.bigPurchases != null);
  const drieTerug = laatsteKoop ? data.confidence[data.confidence.indexOf(laatsteKoop) - 3] : undefined;

  const prijzen = data.prices.filter((p) => p.pvc != null || p.parket != null || p.lijm != null);
  const laatstePrijs = [...prijzen].reverse().find((p) => p.pvc != null);
  const jaarTerug = laatstePrijs
    ? prijzen.find((p) => p.month === `${Number(laatstePrijs.month.slice(0, 4)) - 1}${laatstePrijs.month.slice(4)}`)
    : undefined;
  const pvcJaar = laatstePrijs?.pvc != null && jaarTerug?.pvc ? ((laatstePrijs.pvc - jaarTerug.pvc) / jaarTerug.pvc) * 100 : null;

  const eigenInkoop = data.own.filter((o) => o.purchasePerM2 != null);
  const eigenNu = eigenInkoop.slice(-3);
  const eigenToen = eigenInkoop.slice(-15, -12);
  const gem = (xs: typeof eigenInkoop) => (xs.length ? xs.reduce((s, o) => s + (o.purchasePerM2 ?? 0), 0) / xs.length : null);
  const eigenNuGem = gem(eigenNu);
  const eigenToenGem = gem(eigenToen);

  return (
    <section className="space-y-4">
      <SectionLabel>Markt — open data van het CBS</SectionLabel>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Koopstemming en je omzet"
          subtitle={
            laatsteKoop?.bigPurchases != null
              ? `"Gunstige tijd voor grote aankopen": ${laatsteKoop.bigPurchases} in ${lang(laatsteKoop.month)}${
                  drieTerug?.bigPurchases != null ? `, ${laatsteKoop.bigPurchases > drieTerug.bigPurchases ? 'beter' : laatsteKoop.bigPurchases < drieTerug.bigPurchases ? 'slechter' : 'gelijk'} dan drie maanden eerder (${drieTerug.bigPurchases})` : ''
                }. Onder nul: meer pessimisten dan optimisten.`
              : 'Consumentenvertrouwen, CBS'
          }
        >
          {koop.length === 0 ? (
            <Empty>CBS niet bereikbaar.</Empty>
          ) : (
            <>
              <ChartLegend
                items={[
                  { label: 'Je omzet geaccepteerd', color: KLEUR.omzet },
                  { label: 'Gunstige tijd voor grote aankopen', color: KLEUR.koop },
                ]}
              />
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={koop} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={kort} tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} tickMargin={8} minTickGap={18} />
                  <YAxis yAxisId="eur" tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
                  <YAxis yAxisId="idx" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={34} />
                  <ReferenceLine yAxisId="idx" y={0} stroke={CHART.axis} strokeDasharray="3 3" />
                  <Tooltip
                    cursor={{ fill: CHART.cursor }}
                    content={<ChartTooltip labelFormat={lang} format={(v, k) => (k === 'revenue' ? formatEuro(v) : String(v))} dotColors={{ revenue: '#a8a29e', bigPurchases: KLEUR.koop }} />}
                  />
                  <Bar yAxisId="eur" dataKey="revenue" name="Je omzet" fill={KLEUR.omzet} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Line yAxisId="idx" type="monotone" dataKey="bigPurchases" name="Grote aankopen" stroke={KLEUR.koop} strokeWidth={2.4} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </Panel>

        <Panel
          title="Inkoopprijzen in de markt"
          subtitle={
            pvcJaar != null && laatstePrijs
              ? `Invoerprijs kunststof vloerbedekking ${pct(pvcJaar)} op jaarbasis (${lang(laatstePrijs.month)}). ${
                  eigenNuGem != null && eigenToenGem != null
                    ? `Jouw gemiddelde inkoop per m²: ${formatEuro(eigenNuGem, true)}, een jaar eerder ${formatEuro(eigenToenGem, true)}.`
                    : ''
                }`
              : 'Invoerprijsindex, CBS (2021 = 100)'
          }
        >
          {prijzen.length === 0 ? (
            <Empty>CBS niet bereikbaar.</Empty>
          ) : (
            <>
              <ChartLegend
                items={[
                  { label: 'PVC / kunststof vloer', color: KLEUR.pvc },
                  { label: 'Parketpanelen', color: KLEUR.parket },
                  { label: 'Lijm', color: KLEUR.lijm },
                ]}
              />
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={prijzen} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={kort} tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} tickMargin={8} minTickGap={18} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={38} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v) => String(Math.round(v))} />
                  <ReferenceLine y={100} stroke={CHART.axis} strokeDasharray="3 3" />
                  <Tooltip
                    cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                    content={<ChartTooltip labelFormat={lang} format={(v) => v.toFixed(1).replace('.', ',')} dotColors={{ pvc: KLEUR.pvc, parket: KLEUR.parket, lijm: KLEUR.lijm }} />}
                  />
                  <Line type="monotone" dataKey="pvc" name="PVC" stroke={KLEUR.pvc} strokeWidth={2.4} dot={false} connectNulls />
                  <Line type="monotone" dataKey="parket" name="Parket" stroke={KLEUR.parket} strokeWidth={1.8} dot={false} connectNulls />
                  <Line type="monotone" dataKey="lijm" name="Lijm" stroke={KLEUR.lijm} strokeWidth={1.8} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-[11.5px] text-ink-faint">Index, 2021 = 100. Bron: CBS, Producentenprijzen (tabel 85770NED), invoerprijzen.</p>
            </>
          )}
        </Panel>
      </div>
    </section>
  );
}
