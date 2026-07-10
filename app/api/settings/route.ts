// Settings API — read/edit date-effective prices, cost settings, and excluded
// quotation IDs. Session-gated by proxy.ts. Edits insert new effective-dated
// rows (non-retroactive) or toggle exclusions.
import { NextResponse } from 'next/server';
import {
  getCurrentPrices,
  getCurrentCosts,
  listExclusions,
  addPrice,
  addCost,
  addExclusion,
  removeExclusion,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function currentState() {
  const [prices, costs, exclusions] = await Promise.all([
    getCurrentPrices(),
    getCurrentCosts(),
    listExclusions(),
  ]);
  return { prices, costs, exclusions };
}

export async function GET() {
  return NextResponse.json(await currentState());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const bad = (msg: string) => NextResponse.json({ ok: false, error: msg }, { status: 400 });

  try {
    switch (body.type) {
      case 'price': {
        const code = String(body.code ?? '').trim();
        const price = Number(body.price);
        if (!code || !Number.isFinite(price) || price < 0) return bad('Ongeldige prijs of code.');
        await addPrice(code, price);
        break;
      }
      case 'cost': {
        const key = String(body.key ?? '').trim();
        const value = Number(body.value);
        if (!key || !Number.isFinite(value) || value < 0) return bad('Ongeldige waarde.');
        await addCost(key, value);
        break;
      }
      case 'exclusion-add': {
        const id = String(body.id ?? '').trim();
        if (!id) return bad('Geen offerte-ID opgegeven.');
        await addExclusion(id, (body.reason as string) ?? null);
        break;
      }
      case 'exclusion-remove': {
        const id = String(body.id ?? '').trim();
        if (!id) return bad('Geen offerte-ID opgegeven.');
        await removeExclusion(id);
        break;
      }
      default:
        return bad('Onbekende actie.');
    }
    return NextResponse.json({ ok: true, ...(await currentState()) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
