// POST /api/refresh — the dashboard "Vernieuwen" button. Session-gated by proxy.ts.
//
// Two modes:
//  - If GITHUB_DISPATCH_TOKEN + GITHUB_REPO are set (production on Vercel Hobby),
//    trigger the GitHub Actions sync workflow and return immediately. The heavy
//    sync runs in Actions (no 60s limit) and writes to Upstash.
//  - Otherwise (local dev, or Vercel Pro), run the sync inline.
import { NextResponse } from 'next/server';
import { syncAndStore } from '@/lib/teamleader/sync';
import { syncAds } from '@/lib/ads-sync';
import { syncMetaAds } from '@/lib/meta-ads-sync';

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
  // Google Ads loopt parallel mee: eigen bron, eigen tabel, geen Teamleader-lock.
  // Een fout daar staat in ads_sync_meta en in het antwoord, maar houdt de
  // Teamleader-sync niet tegen. Zonder koppeling slaat syncAds zelf stil over.
  const adsRun = Promise.all([syncAds(), syncMetaAds()]).then(([google, meta]) => ({
    ok: google.ok || meta.ok,
    google,
    meta,
    // Eén foutzin voor de melding in de kop; overgeslagen platforms tellen niet.
    error: [google, meta].filter((r) => !r.ok && !r.skipped).map((r) => r.error).join(' · ') || undefined,
  }));

  // Production (Hobby): hand off to GitHub Actions.
  const dispatched = await dispatchGitHubWorkflow();
  if (dispatched) {
    await adsRun;
    return dispatched;
  }

  // Local / Pro: run inline.
  try {
    const [{ meta }, ads] = await Promise.all([
      syncAndStore({ force: false, owner: 'vernieuwknop' }),
      adsRun,
    ]);
    return NextResponse.json({ ok: true, meta, ads });
  } catch (err) {
    await adsRun;
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('Er loopt al een synchronisatie') ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
