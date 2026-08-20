// POST /api/sync — run the full Teamleader pipeline. Called by Vercel Cron
// (with CRON_SECRET) or manually. Long-running: maxDuration raised.
// Self-protected by CRON_SECRET because proxy.ts leaves this path open so the
// cron (which has no session cookie) can reach it.
import { NextResponse } from 'next/server';
import { syncAndStore } from '@/lib/teamleader/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // seconds (capped by Vercel plan — see docs/DEPLOYMENT.md)

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production'; // allow in local dev only
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true; // Vercel cron sends this header
  const url = new URL(request.url);
  return url.searchParams.get('secret') === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { meta } = await syncAndStore({ force: false, owner: 'cron/api-sync' });
    return NextResponse.json({ ok: true, meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 409 = de lock was bezet; dat is geen storing maar "kom straks terug".
    const status = message.startsWith('Er loopt al een synchronisatie') ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

// Vercel Cron issues GET by default; support both.
export const GET = POST;
