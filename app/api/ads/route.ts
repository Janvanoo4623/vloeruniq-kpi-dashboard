// GET  /api/ads?from&to&compare — Google Ads-cijfers voor een periode, plus de
//      budgetstand per maand. Session-gated door proxy.ts.
// POST /api/ads { platform: 'google'|'meta', month: 'YYYY-MM' | 'default', amount: number | null } — maandbudget.
import { NextResponse } from 'next/server';
import { buildAdsPayload } from '@/lib/ads-payload';
import { setAdsBudget } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || iso(Date.now());
  const from = url.searchParams.get('from') || iso(Date.now() - 29 * DAY);
  const compare = url.searchParams.get('compare') || 'none';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ ok: false, error: 'Ongeldige periode.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await buildAdsPayload(from, to, compare)) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const month = String(body.month ?? '').trim();
  if (!(month === 'default' || /^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
    return NextResponse.json({ ok: false, error: 'Ongeldige maand.' }, { status: 400 });
  }
  let amount: number | null = null;
  if (body.amount != null && body.amount !== '') {
    amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ ok: false, error: 'Ongeldig bedrag.' }, { status: 400 });
    }
    amount = Math.round(amount * 100) / 100;
  }
  const platform = body.platform === 'meta' ? 'meta' : 'google';
  try {
    const budgets = await setAdsBudget(month, amount, platform);
    return NextResponse.json({ ok: true, budgets });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
