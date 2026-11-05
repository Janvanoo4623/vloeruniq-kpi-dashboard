import { getAllQuotations, getCurrentPrices, getResolveInput, getReviewedIds } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
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
  const [quotations, prices, resolveInput, gezienArbeid, gezienGeenVloer] = await Promise.all([
    getAllQuotations(),
    getCurrentPrices(),
    getResolveInput(),
    getReviewedIds('labor'),
    getReviewedIds('unmatched'),
  ]);
  // Alleen offertes die (nog) iets kunnen opleveren. Verlopen en geweigerde
  // offertes tellen nergens mee in omzet of marge, dus nakijken heeft geen zin
  // (Jan, 2026-11-05: "de meesten hiervan zijn nooit een opdracht geworden").
  // Een verlopen offerte met facturen op de deal is na resolveQuotations
  // 'accepted' (wonByInvoice) en blijft er dus wél in.
  const resolved = resolveQuotations(quotations, resolveInput).filter(
    (q) => q.status === 'accepted' || q.status === 'open',
  );
  const pricedCodes = new Set(prices.map((p) => p.code.toLowerCase()));

  return (
    <ControleView
      review={computeReviewList(resolved, resolveInput.overrides, gezienArbeid)}
      missing={computeMissingPrices(resolved, pricedCodes)}
      unmatched={computeUnmatchedQuotations(resolved, gezienGeenVloer)}
    />
  );
}
