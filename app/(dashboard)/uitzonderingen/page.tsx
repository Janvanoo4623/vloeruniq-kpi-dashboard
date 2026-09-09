import { getAllQuotations, getResolveInput, listExclusions } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { computeExceptions } from '@/lib/exceptions';
import UitzonderingenView from '@/components/pages/UitzonderingenView';

export const dynamic = 'force-dynamic';

/**
 * Het effect per correctie is een écht verschil: we rekenen dezelfde offertes
 * twee keer door — één keer mét de handmatige correcties en één keer zonder —
 * en trekken die van elkaar af. Allebei de keren tegen dezelfde prijzen en
 * kosten, anders zou een prijswijziging als correctie-effect worden geteld.
 */
export default async function UitzonderingenPage() {
  const [raw, resolveInput, exclusions] = await Promise.all([
    getAllQuotations(),
    getResolveInput(),
    listExclusions(),
  ]);
  const corrected = resolveQuotations(raw, resolveInput);
  const zonder = resolveQuotations(raw, { ...resolveInput, overrides: {} });
  return (
    <UitzonderingenView
      data={computeExceptions(corrected, zonder, resolveInput.overrides, exclusions)}
    />
  );
}
