'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CircleCheck, Coins, Factory, Receipt, Scale, ShieldCheck, Wallet } from 'lucide-react';
import type { ResultaatData, ResultMonth } from '@/lib/resultaat';
import type { LedgerKind } from '@/lib/moneybird';
import { formatDateTime, formatEuro, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import { CHART } from '@/components/charts/theme';
import { Empty, Panel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';
import HeroCard, { MiniStat } from '@/components/page/HeroCard';
import HighlightChart from '@/components/page/HighlightChart';
import { BENTO, DetailsLabel, InsightCard, StatTile, type Insight } from '@/components/overview/cards';

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAAND_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const kort = (m: string) => MAAND[Number(m.slice(5, 7)) - 1];
const lang = (m: string) => `${MAAND_LANG[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// Kosten zijn geld dat weggaat: gedempte tinten, geen rood.
const KLEUR = {
  direct: CHART.open,
  expenses: CHART.adsCost,
  result: CHART.accepted,
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
 * Resultaat, opgebouwd als elke pagina sinds 2026-10-19:
 *  1. het kerngetal (bedrijfsresultaat) in de zwarte kaart, met wat de andere
 *     bronnen erover zeggen ernaast;
 *  2. vier tegels: omzet, de twee soorten kosten, het break-evenpunt;
 *  3. de hoofdgrafiek: resultaat, omzet of kosten per maand;
 *  4. verdieping: waar het geld heen gaat, per grootboekrekening, startmaand.
 * Omzet komt uit Teamleader, kosten uit Moneybird — zie lib/resultaat.ts.
 */
export default function ResultaatView({ data }: { data: ResultaatData }) {
  const router = useRouter();
  const { range, refreshCount, today } = useDashboard();

  // Vernieuwen haalt Moneybird opnieuw op; deze pagina rekent op de server.
  useEffect(() => {
    if (refreshCount > 0) router.refresh();
  }, [refreshCount, router]);

  const compleet = data.months.filter((m) => m.complete);

  // De periodekiezer werkt in dagen, de boekhouding in maanden: de hele maanden
  // die de periode raakt, en anders de laatste drie complete.
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

  const t = maanden.reduce(
    (a, m) => ({ revenue: a.revenue + m.revenue, directCosts: a.directCosts + m.directCosts, expenses: a.expenses + m.expenses, other: a.other + m.other }),
    { revenue: 0, directCosts: 0, expenses: 0, other: 0 },
  );
  const res = resultaat(t);
  const brutoPct = t.revenue > 0 ? ((t.revenue - t.directCosts) / t.revenue) * 100 : null;
  const resPct = t.revenue > 0 ? (res / t.revenue) * 100 : null;
  const metCalc = maanden.filter((m) => m.calcMarginPct != null && m.revenue > 0);
  const calcPct =
    metCalc.length > 0 ? metCalc.reduce((s, m) => s + (m.calcMarginPct ?? 0) * m.revenue, 0) / metCalc.reduce((s, m) => s + m.revenue, 0) : null;
  const lopend = maanden.some((m) => m.running);
  const periode =
    maanden.length === 1 ? lang(maanden[0].month) : `${lang(maanden[0].month)} t/m ${lang(maanden[maanden.length - 1].month)}`;

  const be = today.breakEven;
  const laatste12 = data.months.slice(-12);

  return (
    <div className="space-y-5">
      {data.error && (
        <div className="rounded-2xl bg-crit-soft px-5 py-3 text-[13px] text-crit">
          Laatste ophaalpoging uit Moneybird mislukte: {data.error}. Je ziet de cijfers van {formatDateTime(data.syncedAt)}.
        </div>
      )}

      {/* 1. Kerngetal en duiding */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
        <HeroCard
          label={periode.charAt(0).toUpperCase() + periode.slice(1)}
          status={lopend ? 'lopende maand' : terugval ? 'laatste complete maanden' : undefined}
          tone="neutral"
          value={res}
          format={(v) => formatEuro(v)}
          valueTone={res < 0 ? 'crit' : undefined}
          sub={
            <>
              Bedrijfsresultaat vóór belasting
              {resPct != null && <> · {formatPercent(resPct)} van {formatEuro(t.revenue)} gefactureerd</>}
            </>
          }
          href="/marge"
          hrefLabel="Naar marge"
        >
          <MiniStat label="Brutomarge, echt" value={formatPercent(brutoPct)} sub="omzet min inkoop en uitbesteed werk" bar={brutoPct != null ? brutoPct / 100 : null} />
          <MiniStat
            label="Brutomarge, berekend"
            value={calcPct != null ? formatPercent(calcPct) : '—'}
            sub={calcPct != null ? 'uit de prijslijst' : 'volgt zodra facturen aan offertes gekoppeld zijn'}
            bar={calcPct != null ? calcPct / 100 : null}
          />
        </HeroCard>
        <InsightCard title="Klopt het beeld?" items={signaalLijst(data, maanden)} />
      </div>

      {/* 2. Tegels */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile Icon={Receipt} label="Gefactureerd" value={formatEuro(t.revenue)} sub="uit Teamleader, ex btw" bars={laatste12.map((m) => m.revenue)} />
        <StatTile
          Icon={Factory}
          label="Directe kosten"
          value={formatEuro(t.directCosts)}
          sub={t.revenue > 0 ? `${formatPercent((t.directCosts / t.revenue) * 100)} van de omzet · inkoop en uitbesteed werk` : undefined}
          bars={laatste12.map((m) => m.directCosts)}
        />
        <StatTile
          Icon={Coins}
          label="Bedrijfskosten"
          value={formatEuro(t.expenses)}
          sub={t.revenue > 0 ? `${formatPercent((t.expenses / t.revenue) * 100)} van de omzet · vaste lasten` : undefined}
          bars={laatste12.map((m) => m.expenses)}
        />
        {be ? (
          <StatTile
            Icon={Scale}
            label="Break-evenpunt"
            value={formatEuro(be.revenueNeeded)}
            sub={
              be.invoicedThisMonth >= be.revenueNeeded
                ? `Deze maand gedekt: ${formatEuro(be.invoicedThisMonth)} gefactureerd`
                : `Deze maand nog ${formatEuro(be.revenueNeeded - be.invoicedThisMonth)} te factureren`
            }
          />
        ) : (
          <StatTile Icon={Wallet} label="Overig" value={formatEuro(t.other)} sub="overige baten en lasten" />
        )}
      </div>

      {/* 3. Hoofdgrafiek */}
      <HighlightChart
        series={[
          {
            key: 'res',
            label: 'Resultaat',
            title: 'Resultaat per maand',
            fmt: (v) => formatEuro(v),
            // Alleen complete maanden: daarvoor waren de kosten nog niet geboekt
            // en was het "resultaat" gewoon de hele omzet.
            points: laatste12.filter((m) => m.complete).map((m) => ({ label: kort(m.month), value: Math.round(resultaat(m)), current: m.running })),
            sub: `Vanaf ${lang(data.startMonth)}, de eerste maand met een complete boekhouding`,
          },
          {
            key: 'omzet',
            label: 'Gefactureerd',
            title: 'Gefactureerd per maand',
            fmt: (v) => formatEuro(v),
            points: laatste12.map((m) => ({ label: kort(m.month), value: Math.round(m.revenue), current: m.running, muted: !m.complete })),
          },
          {
            key: 'kosten',
            label: 'Kosten',
            title: 'Kosten per maand',
            fmt: (v) => formatEuro(v),
            points: laatste12.map((m) => ({ label: kort(m.month), value: Math.round(m.directCosts + m.expenses), current: m.running, muted: !m.complete })),
          },
        ]}
        footnote="De lopende maand staat lichter: nog niet alles is geboekt"
      />

      {/* 4. Verdieping */}
      <DetailsLabel />
      <Verdeling t={t} res={res} />
      <KostenTabel data={data} maanden={maanden} />
      <StartMaand data={data} />
    </div>
  );
}

// ── Waar de omzet heen gaat ──────────────────────────────────────────────

function Verdeling({ t, res }: { t: { revenue: number; directCosts: number; expenses: number; other: number }; res: number }) {
  const schaal = Math.max(t.revenue, t.directCosts + t.expenses, 1);
  const delen = [
    { label: 'Directe kosten', v: t.directCosts, kleur: KLEUR.direct },
    { label: 'Bedrijfskosten', v: t.expenses, kleur: KLEUR.expenses },
    { label: 'Resultaat', v: Math.max(0, res), kleur: KLEUR.result },
  ];
  return (
    <div className={cn(BENTO, 'p-6')}>
      <h3 className="text-[16px] font-semibold tracking-tight text-ink">Waar elke gefactureerde euro heen gaat</h3>
      <div className="mt-5 flex h-4 w-full gap-[3px] overflow-hidden rounded-full bg-sunk">
        {delen.map((d) => (
          <span key={d.label} className="block h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(d.v / schaal) * 100}%`, background: d.kleur }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-4">
        <li>
          <span className="text-ink-mute">Gefactureerd</span>
          <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-ink">{formatEuro(t.revenue)}</div>
        </li>
        {delen.map((d) => (
          <li key={d.label}>
            <span className="flex items-center gap-1.5 text-ink-mute">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.kleur }} />
              {d.label}
            </span>
            <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-ink">
              {d.label === 'Resultaat' ? formatEuro(res) : `− ${formatEuro(d.v)}`}
              {t.revenue > 0 && <span className="ml-1.5 text-[12px] font-normal text-ink-faint">{formatPercent(((d.label === 'Resultaat' ? res : d.v) / t.revenue) * 100)}</span>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
        Inkoop wordt vaak eerder geboekt dan de factuur aan de klant, dus één losse maand schommelt; kijk over een paar maanden samen voor het echte beeld.
      </p>
    </div>
  );
}

// ── Klopt het beeld? ─────────────────────────────────────────────────────

/**
 * Alleen wat er nú speelt. Een lege rekening kan betekenen dat er geen kosten
 * waren — of dat ze ergens anders geboekt worden. Waar een andere bron het
 * eerste tegenspreekt, zeggen we het.
 */
function signaalLijst(data: ResultaatData, maanden: ResultMonth[]): Insight[] {
  const uit: Insight[] = [];
  const som = (f: (m: ResultMonth) => number) => maanden.reduce((s, m) => s + f(m), 0);

  const loon = data.accounts.filter((a) => /loon|salaris|personeel|sociale lasten|pensioen/i.test(a.name));
  if (som((m) => loon.reduce((s, a) => s + (m.values[a.id] ?? 0), 0)) < 1) {
    uit.push({ Icon: AlertTriangle, tone: 'warn', text: 'Er zijn **geen loonkosten** geboekt. Lopen de lonen via een andere administratie of als uitbesteed werk, dan klopt het; anders is het resultaat te rooskleurig.' });
  }

  const reclameIds = data.accounts.filter((a) => /reclame|advertentie|marketing/i.test(a.name)).map((a) => a.id);
  const reclame = som((m) => reclameIds.reduce((s, id) => s + (m.values[id] ?? 0), 0));
  const ads = som((m) => m.adsCost);
  if (ads > 100 && reclame < ads * 0.5) {
    uit.push({ Icon: AlertTriangle, tone: 'warn', text: `Google en Meta kostten **${formatEuro(ads)}**, maar op reclamekosten staat **${formatEuro(reclame)}**. Die afschrijvingen worden waarschijnlijk (nog) niet geboekt.` });
  } else if (ads > 100) {
    uit.push({ Icon: CircleCheck, tone: 'brand', text: `Advertentiekosten staan in de boekhouding: **${formatEuro(reclame)}** geboekt tegenover ${formatEuro(ads)} bij Google en Meta.` });
  }

  const overlap = maanden.filter((m) => m.mbRevenue > 0 && m.revenue > 0);
  const tl = overlap.reduce((s, m) => s + m.revenue, 0);
  const mb = overlap.reduce((s, m) => s + m.mbRevenue, 0);
  if (tl > 0 && Math.abs(mb - tl) / tl > 0.05) {
    uit.push({ Icon: AlertTriangle, tone: 'warn', text: `De omzet in Moneybird (**${formatEuro(mb)}**) wijkt meer dan 5% af van Teamleader (**${formatEuro(tl)}**). Mogelijk mist Combidesk facturen.` });
  } else if (tl > 0) {
    uit.push({ Icon: ShieldCheck, tone: 'brand', text: `Omzet in Moneybird (${formatEuro(mb)}) en Teamleader (${formatEuro(tl)}) **komen overeen**: de facturen lopen goed door.` });
  }
  return uit;
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

