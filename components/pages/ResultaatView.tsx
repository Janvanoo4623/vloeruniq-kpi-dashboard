'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ResultaatData, ResultMonth } from '@/lib/resultaat';
import type { LedgerKind } from '@/lib/moneybird';
import { formatDateTime, formatEuro, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Badge, Empty, Panel, SectionLabel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAAND_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const kort = (m: string) => `${MAAND[Number(m.slice(5, 7)) - 1]} ’${m.slice(2, 4)}`;
const lang = (m: string) => `${MAAND_LANG[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

// Kosten zijn geld dat weggaat: gedempte tinten, geen rood. Rood is alleen voor
// een negatief resultaat — daar betekent het iets.
const KLEUR = {
  revenue: CHART.accepted,
  direct: CHART.open,
  expenses: CHART.adsCost,
  result: CHART.margin,
};

const SOORT: Record<LedgerKind, string> = {
  revenue: 'Omzet',
  direct_costs: 'Directe kosten',
  expenses: 'Bedrijfskosten',
  other_income_expenses: 'Overig',
};

const resultaat = (m: Pick<ResultMonth, 'revenue' | 'directCosts' | 'expenses' | 'other'>) =>
  m.revenue - m.directCosts - m.expenses + m.other;

/**
 * Wat er onderaan overblijft.
 *
 * De paginaopbouw volgt de vraag die een eigenaar stelt: hoeveel hou ik over
 * (het grote getal), waar gaat het geld heen (de balk en de tabel), en klopt het
 * beeld wel (de signalen onderaan). Omzet komt uit Teamleader, kosten uit
 * Moneybird — waarom staat in lib/resultaat.ts.
 */
export default function ResultaatView({ data }: { data: ResultaatData }) {
  const router = useRouter();
  const { range, refreshCount } = useDashboard();

  // Vernieuwen haalt Moneybird opnieuw op; deze pagina rekent op de server, dus
  // daarna opnieuw laten renderen.
  useEffect(() => {
    if (refreshCount > 0) router.refresh();
  }, [refreshCount, router]);

  const compleet = data.months.filter((m) => m.complete);

  // De periodekiezer werkt in dagen, de boekhouding in maanden. We nemen de
  // hele maanden die de gekozen periode raakt; raakt hij geen complete maand,
  // dan de laatste drie complete.
  const { maanden, terugval } = useMemo(() => {
    const van = range.from.slice(0, 7);
    const tot = range.to.slice(0, 7);
    const binnen = compleet.filter((m) => m.month >= van && m.month <= tot);
    if (binnen.length > 0) return { maanden: binnen, terugval: false };
    return { maanden: compleet.slice(-3), terugval: true };
  }, [compleet, range.from, range.to]);

  if (!data.configured) {
    return (
      <Panel title="Moneybird is nog niet gekoppeld">
        <Empty>Zet MONEYBIRD_TOKEN in .env.local en draai npm run moneybird:token.</Empty>
      </Panel>
    );
  }
  if (data.months.length === 0) {
    return (
      <Panel title="Nog geen gegevens uit Moneybird">
        <Empty>{data.error ?? 'Druk op Vernieuwen om de cijfers uit Moneybird op te halen.'}</Empty>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {data.error && (
        <div className="rounded-xl border border-crit/30 bg-crit-soft px-4 py-3 text-[13px] text-crit">
          Laatste ophaalpoging uit Moneybird mislukte: {data.error}. Je ziet de cijfers van {formatDateTime(data.syncedAt)}.
        </div>
      )}

      <Hero maanden={maanden} terugval={terugval} />

      <MaandGrafiek months={data.months} startMonth={data.startMonth} />

      <KostenTabel data={data} maanden={maanden} />

      <Signalen data={data} maanden={maanden} />

      <StartMaand data={data} />
    </div>
  );
}

// ── Het grote getal ──────────────────────────────────────────────────────

function Hero({ maanden, terugval }: { maanden: ResultMonth[]; terugval: boolean }) {
  const t = maanden.reduce(
    (a, m) => ({
      revenue: a.revenue + m.revenue,
      directCosts: a.directCosts + m.directCosts,
      expenses: a.expenses + m.expenses,
      other: a.other + m.other,
    }),
    { revenue: 0, directCosts: 0, expenses: 0, other: 0 },
  );
  const res = resultaat(t);
  const bruto = t.revenue - t.directCosts;
  const brutoPct = t.revenue > 0 ? (bruto / t.revenue) * 100 : null;
  const resPct = t.revenue > 0 ? (res / t.revenue) * 100 : null;

  // Berekende marge (prijslijst) gewogen naar omzet, alleen over maanden die hem hebben.
  const metCalc = maanden.filter((m) => m.calcMarginPct != null && m.revenue > 0);
  const calcPct =
    metCalc.length > 0
      ? metCalc.reduce((s, m) => s + (m.calcMarginPct ?? 0) * m.revenue, 0) / metCalc.reduce((s, m) => s + m.revenue, 0)
      : null;

  const lopend = maanden.some((m) => m.running);
  const label =
    maanden.length === 0
      ? '—'
      : maanden.length === 1
        ? lang(maanden[0].month)
        : `${lang(maanden[0].month)} t/m ${lang(maanden[maanden.length - 1].month)}`;

  // De balk: alles wat er binnenkwam, opgedeeld in waar het heen ging. Kosten
  // groter dan de omzet? Dan is de balk de kosten, en zegt de tekst het verlies.
  const schaal = Math.max(t.revenue, t.directCosts + t.expenses, 1);
  const delen = [
    { label: 'Directe kosten', v: t.directCosts, kleur: KLEUR.direct },
    { label: 'Bedrijfskosten', v: t.expenses, kleur: KLEUR.expenses },
    { label: 'Resultaat', v: Math.max(0, res), kleur: KLEUR.result },
  ];

  return (
    <section>
      <SectionLabel>
        {label}
        {terugval && ' — de gekozen periode valt vóór de startmaand, dit zijn de laatste complete maanden'}
      </SectionLabel>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-[12px] font-medium text-ink-mute">Bedrijfsresultaat, vóór belasting</p>
            <p className={cn('mt-1 text-[48px] font-bold leading-none tracking-tight tabular-nums', res < 0 ? 'text-crit' : 'text-ink')}>
              {formatEuro(res)}
            </p>
            <p className="mt-2 text-[12.5px] text-ink-mute">
              {resPct != null && `${formatPercent(resPct)} van ${formatEuro(t.revenue)} gefactureerd`}
              {lopend && ' · lopende maand nog niet volledig geboekt'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-sunk px-4 py-3">
              <p className="text-[12px] font-medium text-ink-mute">Brutomarge, echt</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink">{formatPercent(brutoPct)}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">omzet min inkoop en uitbesteed werk</p>
            </div>
            <div className="rounded-xl bg-sunk px-4 py-3">
              <p className="text-[12px] font-medium text-ink-mute">Brutomarge, berekend</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink-soft">{calcPct != null ? formatPercent(calcPct) : '—'}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">
                {calcPct != null ? 'uit de prijslijst, op dezelfde facturen' : 'volgt zodra facturen aan offertes gekoppeld zijn'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-sunk">
            {delen.map((d) => (
              <span key={d.label} className="block h-full" style={{ width: `${(d.v / schaal) * 100}%`, background: d.kleur }} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-[12.5px] sm:grid-cols-4">
            <li>
              <span className="text-ink-mute">Gefactureerd</span>
              <div className="font-semibold tabular-nums text-ink">{formatEuro(t.revenue)}</div>
            </li>
            {delen.slice(0, 2).map((d) => (
              <li key={d.label}>
                <span className="flex items-center gap-1.5 text-ink-mute">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.kleur }} />
                  {d.label}
                </span>
                <div className="font-semibold tabular-nums text-ink">
                  − {formatEuro(d.v)}
                  {t.revenue > 0 && <span className="ml-1.5 text-[11.5px] font-normal text-ink-faint">{formatPercent((d.v / t.revenue) * 100)}</span>}
                </div>
              </li>
            ))}
            <li>
              <span className="flex items-center gap-1.5 text-ink-mute">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: KLEUR.result }} />
                Resultaat
              </span>
              <div className={cn('font-semibold tabular-nums', res < 0 ? 'text-crit' : 'text-ink')}>
                = {formatEuro(res)}
                {Math.abs(t.other) >= 1 && (
                  <span className="ml-1.5 text-[11.5px] font-normal text-ink-faint">incl. {formatEuro(t.other)} overig</span>
                )}
              </div>
            </li>
          </ul>
        </div>
        <p className="mt-4 border-t border-hair pt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Omzet zijn de facturen uit Teamleader, kosten komen uit de boekhouding in Moneybird, per hele maand.
          Inkoop wordt vaak eerder geboekt dan de factuur aan de klant, dus één losse maand schommelt; kijk
          over een paar maanden samen voor het echte beeld.
        </p>
      </div>
    </section>
  );
}

// ── Per maand ────────────────────────────────────────────────────────────

function MaandGrafiek({ months, startMonth }: { months: ResultMonth[]; startMonth: string }) {
  const punten = months.map((m) => ({
    month: m.month,
    revenue: Math.round(m.revenue),
    directCosts: Math.round(m.directCosts),
    expenses: Math.round(m.expenses),
    result: m.complete ? Math.round(resultaat(m)) : null,
    complete: m.complete,
  }));

  return (
    <Panel
      title="Per maand"
      subtitle={`Gefactureerd tegenover de kosten. Maanden vóór ${lang(startMonth)} zijn lichter: daar was de boekhouding nog niet compleet en telt het resultaat niet mee.`}
    >
      <ChartLegend
        items={[
          { label: 'Gefactureerd', color: KLEUR.revenue },
          { label: 'Directe kosten', color: KLEUR.direct },
          { label: 'Bedrijfskosten', color: KLEUR.expenses },
          { label: 'Resultaat', color: KLEUR.result },
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={punten} margin={{ top: 6, right: 8, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="month" tickFormatter={kort} tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} tickMargin={8} />
          <YAxis tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            cursor={{ fill: CHART.cursor }}
            content={
              <ChartTooltip
                labelFormat={lang}
                format={(v) => formatEuro(v)}
                dotColors={{ revenue: KLEUR.revenue, directCosts: KLEUR.direct, expenses: KLEUR.expenses, result: KLEUR.result }}
              />
            }
          />
          <Bar dataKey="revenue" name="Gefactureerd" stackId="omzet" fill={KLEUR.revenue} radius={[3, 3, 0, 0]} maxBarSize={22}>
            {punten.map((p) => (
              <Cell key={p.month} fillOpacity={p.complete ? 0.9 : 0.3} />
            ))}
          </Bar>
          <Bar dataKey="directCosts" name="Directe kosten" stackId="kosten" fill={KLEUR.direct} maxBarSize={22}>
            {punten.map((p) => (
              <Cell key={p.month} fillOpacity={p.complete ? 0.9 : 0.3} />
            ))}
          </Bar>
          <Bar dataKey="expenses" name="Bedrijfskosten" stackId="kosten" fill={KLEUR.expenses} radius={[3, 3, 0, 0]} maxBarSize={22}>
            {punten.map((p) => (
              <Cell key={p.month} fillOpacity={p.complete ? 0.9 : 0.3} />
            ))}
          </Bar>
          <Line
            type="linear"
            dataKey="result"
            name="Resultaat"
            stroke={KLEUR.result}
            strokeWidth={2.4}
            dot={{ r: 3, fill: KLEUR.result, strokeWidth: 0 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// ── Waar het geld heen gaat ──────────────────────────────────────────────

function KostenTabel({ data, maanden }: { data: ResultaatData; maanden: ResultMonth[] }) {
  const omzet = maanden.reduce((s, m) => s + m.revenue, 0);
  const rijen = useMemo(() => {
    const totaal = new Map<string, number>();
    for (const m of maanden) for (const [id, v] of Object.entries(m.values)) totaal.set(id, (totaal.get(id) ?? 0) + v);
    return data.accounts
      .filter((a) => a.kind !== 'revenue')
      .map((a) => ({ ...a, bedrag: totaal.get(a.id) ?? 0 }))
      .filter((a) => Math.abs(a.bedrag) >= 0.5)
      .sort((a, b) => b.bedrag - a.bedrag);
  }, [data.accounts, maanden]);
  const max = Math.max(1, ...rijen.map((r) => r.bedrag));
  const { visible, props } = usePaged(rijen);

  return (
    <Panel title="Kosten per grootboekrekening" subtitle="Over dezelfde maanden als het resultaat, ex btw" bodyClassName="p-0">
      {rijen.length === 0 ? (
        <Empty>Geen kosten geboekt in deze maanden.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-sunk text-xs text-ink-mute">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 text-left font-medium">Rekening</th>
                  <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Soort</th>
                  <th className="px-3 py-2 text-right font-medium">Bedrag</th>
                  <th className="px-5 py-2 text-right font-medium">Van de omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2.5">
                      <div className="text-ink">{r.name}</div>
                      <div className="mt-1 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-sunk">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(0, (r.bedrag / max) * 100)}%`,
                            background: r.kind === 'direct_costs' ? KLEUR.direct : KLEUR.expenses,
                          }}
                        />
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-[12.5px] text-ink-mute sm:table-cell">
                      {SOORT[r.kind]}
                      {r.code && <span className="ml-1.5 text-ink-faint">{r.code}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatEuro(r.bedrag)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                      {omzet > 0 ? formatPercent((r.bedrag / omzet) * 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...props} />
        </>
      )}
    </Panel>
  );
}

// ── Klopt het beeld? ─────────────────────────────────────────────────────

/**
 * Alleen wat er nú speelt. Een lege boekhouding op een rekening kan betekenen
 * dat er geen kosten waren — of dat ze ergens anders geboekt worden. Waar een
 * andere bron het eerste tegenspreekt, zeggen we het.
 */
function Signalen({ data, maanden }: { data: ResultaatData; maanden: ResultMonth[] }) {
  const signalen: { tekst: string; toon: 'warn' | 'neutral' }[] = [];
  const som = (f: (m: ResultMonth) => number) => maanden.reduce((s, m) => s + f(m), 0);

  const reclameIds = data.accounts.filter((a) => /reclame|advertentie|marketing/i.test(a.name)).map((a) => a.id);
  const reclame = som((m) => reclameIds.reduce((s, id) => s + (m.values[id] ?? 0), 0));
  const ads = som((m) => m.adsCost);
  if (ads > 100 && reclame < ads * 0.5) {
    signalen.push({
      toon: 'warn',
      tekst: `Google en Meta kostten in deze maanden ${formatEuro(ads)}, maar op reclamekosten staat in Moneybird ${formatEuro(reclame)}. Waarschijnlijk worden die afschrijvingen (nog) niet geboekt, en dan is het resultaat te rooskleurig.`,
    });
  }

  const loon = data.accounts.filter((a) => /loon|salaris|personeel|sociale lasten|pensioen/i.test(a.name));
  const loonBedrag = som((m) => loon.reduce((s, a) => s + (m.values[a.id] ?? 0), 0));
  if (loonBedrag < 1) {
    signalen.push({
      toon: 'warn',
      tekst: 'Er zijn geen loonkosten geboekt. Wordt het personeel via een andere administratie of als uitbesteed werk betaald, dan klopt dat; anders ontbreekt hier een grote kostenpost.',
    });
  }

  const overlap = maanden.filter((m) => m.mbRevenue > 0 && m.revenue > 0);
  const tl = overlap.reduce((s, m) => s + m.revenue, 0);
  const mb = overlap.reduce((s, m) => s + m.mbRevenue, 0);
  if (tl > 0 && Math.abs(mb - tl) / tl > 0.05) {
    signalen.push({
      toon: 'warn',
      tekst: `De omzet in Moneybird (${formatEuro(mb)}) wijkt meer dan 5% af van wat er in Teamleader gefactureerd is (${formatEuro(tl)}). Mogelijk mist Combidesk facturen, of staat er omzet in Moneybird die niet uit Teamleader komt.`,
    });
  } else if (tl > 0) {
    signalen.push({
      toon: 'neutral',
      tekst: `Controle: de omzet in Moneybird (${formatEuro(mb)}) en in Teamleader (${formatEuro(tl)}) komen overeen — de facturen lopen goed door.`,
    });
  }

  if (signalen.length === 0) return null;
  return (
    <Panel title="Klopt het beeld?" subtitle="Wat de andere bronnen over deze cijfers zeggen">
      <ul className="space-y-2.5">
        {signalen.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-soft">
            <Badge tone={s.toon} className="mt-0.5">
              {s.toon === 'warn' ? 'let op' : 'klopt'}
            </Badge>
            <span>{s.tekst}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ── Vanaf wanneer telt het ───────────────────────────────────────────────

function StartMaand({ data }: { data: ResultaatData }) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function kies(startMonth: string) {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch('/api/moneybird', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startMonth }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) setFout(json.error || 'Opslaan mislukt.');
      else router.refresh();
    } catch {
      setFout('Opslaan mislukt (netwerk).');
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-3 text-[12.5px] text-ink-mute">
      <span>
        Gegevens uit Moneybird{data.administrationName && ` (${data.administrationName})`}, opgehaald {formatDateTime(data.syncedAt)}.
      </span>
      <label className="flex items-center gap-2">
        Boekhouding compleet vanaf
        <select
          value={data.startMonth}
          disabled={bezig}
          onChange={(e) => kies(e.target.value)}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-[12.5px] text-ink"
        >
          {data.months.map((m) => (
            <option key={m.month} value={m.month}>
              {lang(m.month)}
            </option>
          ))}
        </select>
      </label>
      {fout && <span className="w-full text-crit">{fout}</span>}
    </div>
  );
}
