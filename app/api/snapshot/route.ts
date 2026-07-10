// GET /api/snapshot — return the latest computed snapshot + sync meta.
// Session-gated by proxy.ts. Reads the datastore only (fast).
import { NextResponse } from 'next/server';
import { getSnapshot, getMeta } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [snapshot, meta] = await Promise.all([getSnapshot(), getMeta()]);
  return NextResponse.json({ snapshot, meta });
}
