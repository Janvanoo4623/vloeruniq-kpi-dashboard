import { getAllInvoices, getAllQuotations, getExclusions, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { buildResultaat } from '@/lib/resultaat';
import ResultaatView from '@/components/pages/ResultaatView';

export const dynamic = 'force-dynamic';

export default async function ResultaatPage() {
  const [invoices, quotations, exclusions, resolveInput] = await Promise.all([
    getAllInvoices(),
    getAllQuotations(),
    getExclusions(),
    getResolveInput(),
  ]);
  const data = await buildResultaat({
    invoices,
    quotations: resolveQuotations(quotations, resolveInput),
    exclusions,
  });
  return <ResultaatView data={data} />;
}
