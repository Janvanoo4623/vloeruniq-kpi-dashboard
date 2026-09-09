import { getAllInvoices, getAllQuotations, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import {
  customerConcentration,
  paymentDistribution,
  unquotedInvoicing,
} from '@/lib/customers';
import KlantenView from '@/components/pages/KlantenView';

export const dynamic = 'force-dynamic';

export default async function KlantenPage() {
  const [invoices, quotations, resolveInput] = await Promise.all([
    getAllInvoices(),
    getAllQuotations(),
    getResolveInput(),
  ]);
  const resolved = resolveQuotations(quotations, resolveInput);
  const concentration = customerConcentration(invoices);

  return (
    <KlantenView
      concentration={concentration}
      payments={paymentDistribution(invoices, concentration)}
      unquoted={unquotedInvoicing(invoices, resolved)}
    />
  );
}
