// Marge op facturen: dezelfde marge als op de offerte, maar geteld op de datum
// waarop er gefactureerd is in plaats van de datum waarop de klant ja zei.
//
// Waarom dit er is. Jan vroeg (2026-09-30) of "marge afgelopen 30 dagen" over de
// verstuurde facturen ging of over de aanvaarde offertes. Het antwoord was:
// offertes. Dat is een vooruitblik — wat je verkocht hebt — terwijl de
// boekhouding terugkijkt naar wat er gefactureerd is. Tussen die twee zit de
// uitvoeringstijd, dus over een maand lopen ze flink uiteen.
//
// Hoe een factuur aan zijn marge komt. Facturen hebben geen regels met
// inkoopprijzen; offertes wel. Elke factuur in Teamleader hangt aan een deal, en
// elke offerte ook. Via die deal vindt de factuur exact zijn offerte terug —
// niet op klantnaam, wat voor een kwart van de facturen fout of leeg zou gaan.
// De factuur krijgt dan het deel van de offertemarge dat hoort bij het deel van
// de offerte-omzet dat hij factureert: een aanbetaling van 40% draagt 40% van de
// marge, de eindfactuur de rest. Factureer je meer dan de offerte (meerwerk),
// dan gaat de marge naar rato mee — de aanname is dat meerwerk dezelfde marge
// heeft als de rest.
//
// Drie soorten facturen, en die worden nooit stilletjes bij elkaar opgeteld:
//  - marge bekend: gekoppelde offerte met inkoopprijzen;
//  - geen inkoopprijs: wel een offerte, maar zonder marge (vul de prijs aan);
//  - zonder offerte: losse verkoop of een factuur zonder deal.
// Het margepercentage gaat alleen over het eerste deel, en het aandeel daarvan
// staat er altijd bij.
import { CASHFLOW_EXCLUDE, isCredit } from './teamleader/invoices';
import type { InvoiceRow, QuotationRow, QuotationStatus } from './types';

const r2 = (v: number) => Math.round(v * 100) / 100;

export type InvoiceMarginReason = 'ok' | 'geen-inkoopprijs' | 'geen-offerte';

export interface InvoiceMarginRow {
  id: string;
  invoiceDate: string;
  customerName: string;
  amount: number; // ex btw; negatief bij een creditnota
  credit: boolean;
  margin: number | null;
  reason: InvoiceMarginReason;
  quotationId: string | null;
  quotationName: string | null;
  /** Status van de gekoppelde offerte; 'expired' terwijl er gefactureerd is = eigenlijk gewonnen. */
  quotationStatus: QuotationStatus | null;
}

export interface InvoiceMarginPart {
  amount: number;
  count: number;
}

export interface InvoicedMargin {
  /** Alle geboekte facturen in de periode, creditnota's eraf. */
  invoicedExcl: number;
  /** Som van de marge op de facturen waar die bekend is. */
  margin: number;
  /** Marge als % van het gefactureerde bedrag waarvoor de marge bekend is. */
  marginPct: number | null;
  parts: Record<InvoiceMarginReason, InvoiceMarginPart>;
  /**
   * Offertes die gefactureerd zijn maar in Teamleader niet op 'geaccepteerd'
   * staan. Dat zijn gewonnen offertes die als verlopen meetellen in de conversie.
   */
  notAccepted: number;
  rows: InvoiceMarginRow[];
  /** False zolang de kolom invoices.deal_id nog niet gevuld is. */
  linked: boolean;
}

/**
 * Kies per deal de offerte waar de facturen bij horen. Normaal is dat de ene
 * geaccepteerde. Staat geen enkele op geaccepteerd — dat gebeurt: er is
 * gefactureerd terwijl de offerte op 'verlopen' staat — dan de versie waarvan
 * het bedrag het dichtst bij het gefactureerde ligt.
 */
function quotationPerDeal(
  quotations: QuotationRow[],
  invoicedPerDeal: Map<string, number>,
): Map<string, QuotationRow[]> {
  const perDeal = new Map<string, QuotationRow[]>();
  for (const q of quotations) {
    if (!q.dealId) continue;
    (perDeal.get(q.dealId) ?? perDeal.set(q.dealId, []).get(q.dealId)!).push(q);
  }
  const out = new Map<string, QuotationRow[]>();
  for (const [deal, qs] of perDeal) {
    const accepted = qs.filter((q) => q.status === 'accepted');
    if (accepted.length > 0) {
      out.set(deal, accepted);
      continue;
    }
    const target = invoicedPerDeal.get(deal);
    if (target == null) continue; // niet gefactureerd: niet nodig
    const best = [...qs].sort(
      (a, b) =>
        Math.abs(a.revenueExVat - target) - Math.abs(b.revenueExVat - target) ||
        b.dateCreated.localeCompare(a.dateCreated),
    )[0];
    out.set(deal, [best]);
  }
  return out;
}

export function invoicedMargin(
  invoices: InvoiceRow[],
  quotations: QuotationRow[], // al door resolveQuotations heen
  exclusions: Set<string>,
  from: string,
  to: string,
): InvoicedMargin {
  const booked = invoices.filter((i) => i.status !== 'draft' && i.invoiceDate);
  const linked = booked.some((i) => i.dealId);

  // Gefactureerd per deal over álle tijd: de keuze tussen offerteversies hangt
  // niet af van welk stukje toevallig in de periode valt.
  const invoicedPerDeal = new Map<string, number>();
  for (const i of booked) {
    if (i.dealId && !isCredit(i)) invoicedPerDeal.set(i.dealId, (invoicedPerDeal.get(i.dealId) ?? 0) + i.totalExcl);
  }
  const perDeal = quotationPerDeal(quotations, invoicedPerDeal);

  const parts: Record<InvoiceMarginReason, InvoiceMarginPart> = {
    ok: { amount: 0, count: 0 },
    'geen-inkoopprijs': { amount: 0, count: 0 },
    'geen-offerte': { amount: 0, count: 0 },
  };
  const rows: InvoiceMarginRow[] = [];
  const notAccepted = new Set<string>();
  let invoicedExcl = 0;
  let margin = 0;

  for (const inv of booked) {
    if (inv.invoiceDate < from || inv.invoiceDate > to) continue;
    // Intern gefactureerd (NV Vloeren): net als in de cashflow buiten beschouwing.
    if (CASHFLOW_EXCLUDE.test(inv.customerName)) continue;
    const qs = inv.dealId ? perDeal.get(inv.dealId) : undefined;
    // Uitgesloten offertes (intern, NV Vloeren) blijven ook hier buiten.
    if (qs && qs.every((q) => exclusions.has(q.id))) continue;

    const revenue = qs?.reduce((t, q) => t + q.revenueExVat, 0) ?? 0;
    const withMargin = qs?.filter((q) => q.margin != null) ?? [];
    let reason: InvoiceMarginReason;
    let m: number | null = null;
    if (!qs || revenue <= 0) {
      reason = 'geen-offerte';
    } else if (withMargin.length === 0) {
      reason = 'geen-inkoopprijs';
    } else {
      reason = 'ok';
      const totalMargin = withMargin.reduce((t, q) => t + (q.margin ?? 0), 0);
      m = r2((inv.totalExcl / revenue) * totalMargin);
      margin += m;
    }

    const q = qs?.[0] ?? null;
    if (q && q.status !== 'accepted') notAccepted.add(q.id);
    invoicedExcl += inv.totalExcl;
    parts[reason].amount += inv.totalExcl;
    parts[reason].count += 1;
    rows.push({
      id: inv.id,
      invoiceDate: inv.invoiceDate,
      customerName: inv.customerName,
      amount: inv.totalExcl,
      credit: isCredit(inv),
      margin: m,
      reason,
      quotationId: q?.id ?? null,
      quotationName: q?.name ?? null,
      quotationStatus: q?.status ?? null,
    });
  }

  for (const p of Object.values(parts)) p.amount = r2(p.amount);
  rows.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.amount - a.amount);

  return {
    invoicedExcl: r2(invoicedExcl),
    margin: r2(margin),
    marginPct: parts.ok.amount > 0 ? Math.round((margin / parts.ok.amount) * 1000) / 10 : null,
    parts,
    notAccepted: notAccepted.size,
    rows,
    linked,
  };
}
