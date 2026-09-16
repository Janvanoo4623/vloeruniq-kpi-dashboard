import { buildAdsPayload } from '@/lib/ads-payload';
import { DEFAULT_PRESET, presetRangeServer } from '@/lib/default-range';
import MarketingView from '@/components/pages/MarketingView';

export const dynamic = 'force-dynamic';

/**
 * De eerste weergave krijgt de standaardperiode van de server (dezelfde als
 * de layout gebruikt), daarna volgt de view de periodekiezer via /api/ads.
 */
export default async function MarketingPage() {
  const { from, to } = presetRangeServer(DEFAULT_PRESET);
  return <MarketingView initial={await buildAdsPayload(from, to, 'none')} />;
}
