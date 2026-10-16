// POST /api/goals — maanddoelen (omzet, marge, m²) voor Overzicht.
// Leeg of 0 = geen doel. Session-gated by proxy.ts.
import { NextResponse } from 'next/server';
import { setAppSetting } from '@/lib/db';
import type { Goals } from '@/lib/today';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parse = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Record<keyof Goals, unknown>>;
  const goals: Goals = { revenue: parse(body.revenue), margin: parse(body.margin), m2: parse(body.m2) };
  try {
    await setAppSetting('goals', goals);
    return NextResponse.json({ ok: true, goals });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
