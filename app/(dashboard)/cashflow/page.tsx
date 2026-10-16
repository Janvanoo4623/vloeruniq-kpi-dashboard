import { getAllDeals, getAllInvoices, getAllQuotations, getAppSetting, getInvoiceAdjustments, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { quotedVsInvoiced } from '@/lib/customers';
import { getMoneybirdPL } from '@/lib/moneybird';
import { DEFAULT_START, START_KEY, invoicedByMonth } from '@/lib/resultaat';
import { computeCashForecast } from '@/lib/cash-forecast';
import { computePaymentStats } from '@/lib/payments';
import CashflowView from '@/components/pages/CashflowView';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const asOf = new Date().toISOString().slice(0, 10);
  const [invoices, quotations, resolveInput, deals, adjustments, pl, startMonth] = await Promise.all([
    getAllInvoices(),
    getAllQuotations(),
    getResolveInput(),
    getAllDeals(),
    getInvoiceAdjustments(),
    getMoneybirdPL(),
    getAppSetting<string>(START_KEY, DEFAULT_START).catch(() => DEFAULT_START),
  ]);
  const resolved = resolveQuotations(quotations, resolveInput);
  const forecast = computeCashForecast({
    pl,
    invoices,
    adjustments,
    deals,
    quotations: resolved,
    revenueByMonth: invoicedByMonth(invoices),
    startMonth,
    medianDaysToPay: computePaymentStats(invoices, asOf).medianDaysToPay,
    asOf,
  });
  return <CashflowView quotedVsInvoiced={quotedVsInvoiced(resolved, invoices)} forecast={forecast} />;
}
