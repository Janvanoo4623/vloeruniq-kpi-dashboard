import { getAllQuotations, getCurrentPrices, getOverrides, getReviewedIds } from '@/lib/db';
import { applyOverrides } from '@/lib/overrides';
import { computeReviewList } from '@/lib/review';
import { computeMissingPrices, computeUnmatchedQuotations } from '@/lib/missing-prices';
import ControleView from '@/components/pages/ControleView';

export const dynamic = 'force-dynamic';

/**
 * Server component: de werklijst gaat over álle offertes, niet over de gekozen
 * periode, en we sturen alleen het resultaat naar de client in plaats van de
 * hele offertehistorie.
 */
export default async function ControlerenPage() {
  const [quotations, prices, overrides, reviewed] = await Promise.all([
    getAllQuotations(),
    getCurrentPrices(),
    getOverrides(),
    getReviewedIds(),
  ]);
  const resolved = applyOverrides(quotations, overrides);
  const pricedCodes = new Set(prices.map((p) => p.code.toLowerCase()));

  return (
    <ControleView
      review={computeReviewList(resolved, overrides, reviewed)}
      missing={computeMissingPrices(resolved, pricedCodes)}
      unmatched={computeUnmatchedQuotations(resolved)}
    />
  );
}
