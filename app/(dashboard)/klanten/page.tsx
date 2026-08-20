import { getAllInvoices, getAllQuotations, getOverrides } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import {
  customerConcentration,
  paymentDistribution,
  unquotedInvoicing,
} from '@/lib/customers';
import KlantenView from '@/components/pages/KlantenView';

export const dynamic = 'force-dynamic';

export default async function KlantenPage() {
  const [invoices, quotations, overrides] = await Promise.all([
    getAllInvoices(),
    getAllQuotations(),
    getOverrides(),
  ]);
  const resolved = applyOverrides(quotations, overrides);
  const concentration = customerConcentration(invoices);

  return (
    <KlantenView
      concentration={concentration}
      payments={paymentDistribution(invoices, concentration)}
      unquoted={unquotedInvoicing(invoices, resolved)}
    />
  );
}
