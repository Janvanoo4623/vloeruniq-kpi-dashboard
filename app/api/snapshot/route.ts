// GET /api/snapshot — return the latest computed snapshot + sync meta.
// Session-gated by proxy.ts. Reads the datastore only (fast).
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [snapshot, meta] = await Promise.all([store.getSnapshot(), store.getMeta()]);
  return NextResponse.json({ snapshot, meta });
}
