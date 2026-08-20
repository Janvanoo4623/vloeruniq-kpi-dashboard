// POST /api/refresh — the dashboard "Vernieuwen" button. Session-gated by proxy.ts.
//
// Two modes:
//  - If GITHUB_DISPATCH_TOKEN + GITHUB_REPO are set (production on Vercel Hobby),
//    trigger the GitHub Actions sync workflow and return immediately. The heavy
//    sync runs in Actions (no 60s limit) and writes to Upstash.
//  - Otherwise (local dev, or Vercel Pro), run the sync inline.
import { NextResponse } from 'next/server';
import { syncAndStore } from '@/lib/teamleader/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function dispatchGitHubWorkflow(): Promise<NextResponse | null> {
  const repo = process.env.GITHUB_REPO; // "owner/name"
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!repo || !token) return null; // not configured -> caller falls back to inline sync

  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'sync.yml';
  const ref = process.env.GITHUB_REF_NAME || 'main';

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
    },
  );

  if (res.status === 204) {
    return NextResponse.json({ ok: true, dispatched: true });
  }
  const text = await res.text().catch(() => '');
  return NextResponse.json(
    { ok: false, error: `GitHub dispatch mislukt (${res.status}): ${text}` },
    { status: 502 },
  );
}

export async function POST() {
  // Production (Hobby): hand off to GitHub Actions.
  const dispatched = await dispatchGitHubWorkflow();
  if (dispatched) return dispatched;

  // Local / Pro: run inline.
  try {
    const { meta } = await syncAndStore({ force: false, owner: 'vernieuwknop' });
    return NextResponse.json({ ok: true, meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('Er loopt al een synchronisatie') ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
