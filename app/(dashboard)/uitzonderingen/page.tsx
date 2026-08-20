import { getAllQuotations, getOverrides, listExclusions } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { computeExceptions } from '@/lib/exceptions';
import UitzonderingenView from '@/components/pages/UitzonderingenView';

export const dynamic = 'force-dynamic';

/**
 * Het effect per correctie is een écht verschil: we rekenen dezelfde offertes
 * één keer mét en één keer zónder overrides door, en trekken die van elkaar af.
 */
export default async function UitzonderingenPage() {
  const [raw, overrides, exclusions] = await Promise.all([
    getAllQuotations(),
    getOverrides(),
    listExclusions(),
  ]);
  const corrected = applyOverrides(raw, overrides);
  return <UitzonderingenView data={computeExceptions(corrected, raw, overrides, exclusions)} />;
}
