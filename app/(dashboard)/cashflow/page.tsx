import { getAllInvoices, getAllQuotations, getOverrides } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { quotedVsInvoiced } from '@/lib/customers';
import CashflowView from '@/components/pages/CashflowView';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const [invoices, quotations, overrides] = await Promise.all([
    getAllInvoices(),
    getAllQuotations(),
    getOverrides(),
  ]);
  const resolved = applyOverrides(quotations, overrides);
  return <CashflowView quotedVsInvoiced={quotedVsInvoiced(resolved, invoices)} />;
}
