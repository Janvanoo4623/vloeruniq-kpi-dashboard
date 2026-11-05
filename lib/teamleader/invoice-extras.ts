// Factuurregels voor de nacalculatie (overige producten op facturen). Server-only:
// staat los van invoices.ts omdat dat bestand ook in clientcomponenten belandt.
import { apiCall, mapLimit } from './client';
import { FETCH_CONCURRENCY } from './constants';
import { round } from './dates';
import { classifyExtra } from '../extras';
import * as db from '../db';
import type { InvoiceExtraLine, InvoiceRow } from '../types';

interface TLInvoiceDetail {
  grouped_lines?: { line_items?: { description?: string; quantity?: number; total?: { tax_exclusive?: { amount?: number } } }[] }[];
}

/** De overige producten op één factuur, opgeteld per code. */
export function extrasFromInvoice(detail: TLInvoiceDetail | null): InvoiceExtraLine[] {
  const perCode = new Map<string, InvoiceExtraLine>();
  for (const g of detail?.grouped_lines ?? []) {
    for (const item of g.line_items ?? []) {
      const revenue = item.total?.tax_exclusive?.amount ?? 0;
      if (revenue === 0) continue;
      const m = classifyExtra(item.description ?? '', item.quantity ?? 0, revenue);
      if (!m) continue;
      const e = perCode.get(m.code) ?? { code: m.code, unit: m.unit, qty: 0, revenue: 0 };
      e.qty = round(e.qty + (m.quantity ?? item.quantity ?? 0), 2);
      e.revenue = round(e.revenue + revenue, 2);
      perCode.set(m.code, e);
    }
  }
  return [...perCode.values()];
}

/**
 * Factuurregels ophalen voor facturen die we nog niet hebben, voor de
 * nacalculatie (lib/resolve.ts, addInvoiceExtras). invoices.list geeft geen
 * regels, dus dit is één invoices.info per factuur — daarom alleen nieuwe, en
 * per sync hooguit `limit` stuks zodat de cron binnen zijn tijd blijft. Een
 * geboekte factuur verandert in Teamleader niet meer; een concept slaan we over.
 *
 * Gooit nooit: een fout hier mag de sync niet tegenhouden.
 */
export async function syncInvoiceExtras(invoices: InvoiceRow[], limit = Infinity): Promise<{ fetched: number; remaining: number }> {
  try {
    const store = await db.getInvoiceExtras();
    const todo = invoices
      .filter((i) => i.status !== 'draft' && i.totalExcl > 0 && !store.invoices[i.id])
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
    const batch = todo.slice(0, limit);
    if (batch.length === 0) return { fetched: 0, remaining: 0 };
    const details = await mapLimit(batch, FETCH_CONCURRENCY, async (inv) => {
      try {
        const r = await apiCall<{ data?: TLInvoiceDetail }>('/invoices.info', { id: inv.id });
        return r.data ?? null;
      } catch {
        return undefined; // volgende keer opnieuw
      }
    });
    batch.forEach((inv, i) => {
      const d = details[i];
      if (d === undefined) return;
      store.invoices[inv.id] = { dealId: inv.dealId, lines: extrasFromInvoice(d) };
    });
    await db.setInvoiceExtras(store);
    return { fetched: batch.length, remaining: todo.length - batch.length };
  } catch (err) {
    console.warn('[sync] factuurregels niet opgehaald:', err instanceof Error ? err.message : err);
    return { fetched: 0, remaining: -1 };
  }
}
