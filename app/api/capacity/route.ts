// POST /api/capacity — hoeveel m² de ploegen samen per week kunnen leggen.
// Leeg of 0 = niet ingesteld. Session-gated by proxy.ts.
import { NextResponse } from 'next/server';
import { setAppSetting } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { m2PerWeek?: unknown };
  const n = Number(body.m2PerWeek);
  const m2PerWeek = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  try {
    await setAppSetting('capacity', { m2PerWeek });
    return NextResponse.json({ ok: true, m2PerWeek });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
