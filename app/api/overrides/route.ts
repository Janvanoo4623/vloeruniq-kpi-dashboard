// Overrides API — per-quotation manual corrections (feedback 2026-07-13):
// a per-line special purchase price and an offerte-level "no legservice" flag.
// Applied at read time (instant + retroactive). Session-gated by proxy.ts.
import { NextResponse } from 'next/server';
import { getOverrides, setOverridePrice, setOverrideNoLabor, setReviewed } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ overrides: await getOverrides() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const bad = (msg: string) => NextResponse.json({ ok: false, error: msg }, { status: 400 });

  const quotationId = String(body.quotationId ?? '').trim();
  if (!quotationId) return bad('Geen offerte-ID opgegeven.');

  try {
    switch (body.type) {
      case 'price': {
        const lineCode = String(body.lineCode ?? '').trim();
        if (!lineCode) return bad('Geen vloerregel opgegeven.');
        // price null/empty = clear the override for this line.
        if (body.price == null || body.price === '') {
          await setOverridePrice(quotationId, lineCode, null);
          break;
        }
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) return bad('Ongeldige inkoopprijs.');
        await setOverridePrice(quotationId, lineCode, price);
        break;
      }
      case 'no-labor': {
        const noLabor = Boolean(body.noLabor);
        await setOverrideNoLabor(quotationId, noLabor, (body.note as string) ?? null);
        break;
      }
      case 'reviewed': {
        await setReviewed(quotationId, Boolean(body.reviewed));
        break;
      }
      default:
        return bad('Onbekende actie.');
    }
    return NextResponse.json({ ok: true, overrides: await getOverrides() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
