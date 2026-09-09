import { getAllInvoices, getAllQuotations, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { quotedVsInvoiced } from '@/lib/customers';
import CashflowView from '@/components/pages/CashflowView';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const [invoices, quotations, resolveInput] = await Promise.all([
    getAllInvoices(),
    getAllQuotations(),
    getResolveInput(),
  ]);
  const resolved = resolveQuotations(quotations, resolveInput);
  return <CashflowView quotedVsInvoiced={quotedVsInvoiced(resolved, invoices)} />;
}
