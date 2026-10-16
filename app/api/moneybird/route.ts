// POST /api/moneybird — de startmaand van de Resultaat-pagina: vanaf welke maand
// de boekhouding in Moneybird compleet genoeg is om mee te tellen.
// Session-gated by proxy.ts.
import { NextResponse } from 'next/server';
import { setAppSetting } from '@/lib/db';
import { START_KEY } from '@/lib/resultaat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { startMonth?: unknown };
  const startMonth = String(body.startMonth ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) {
    return NextResponse.json({ ok: false, error: 'Ongeldige maand.' }, { status: 400 });
  }
  try {
    await setAppSetting(START_KEY, startMonth);
    return NextResponse.json({ ok: true, startMonth });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
