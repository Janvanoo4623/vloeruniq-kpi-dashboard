// POST /api/planning — de rijen voor Jans planning-Sheet bij een geaccepteerde
// offerte. Aangeroepen door n8n (docs/PLANNING-SHEET.md), niet door de browser.
//
// Zuiver rekenen: geen database, geen Teamleader. n8n haalt de offerte op met
// zijn EIGEN Teamleader-token en stuurt hem mee; dit endpoint mag nooit zelf
// Teamleader aanroepen (één eigenaar per refresh token, zie ARCHITECTURE.md).
//
// Beveiligd met een eigen sleutel (Bearer), los van CRON_SECRET: wie de
// planning kan vullen, hoeft de sync niet te kunnen starten. proxy.ts laat dit
// pad daarom door zonder sessiecookie.
import { NextResponse } from 'next/server';
import {
  linesFromQuotation,
  planningJob,
  planningTarget,
  sheetRows,
  type PlanningLineInput,
} from '@/lib/planning-sheet';
import { getAppSetting } from '@/lib/db';
import { hasSupabase } from '@/lib/supabase';
import { sha256 } from '@/lib/planning-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * De sleutel staat als PLANNING_API_SECRET in de omgeving, óf als sha256-hash in
 * Supabase (app_settings.planning_api, gezet met `npm run planning:token`). Dat
 * tweede bestaat omdat Jasper geen omgevingsvariabelen op Vercel productie kan
 * zetten — hetzelfde patroon als de Moneybird- en Ads-koppeling.
 */
async function authorized(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const env = process.env.PLANNING_API_SECRET;
  if (env) return given === env;
  const stored = hasSupabase() ? await getAppSetting<{ sha256?: string } | null>('planning_api', null) : null;
  if (stored?.sha256) return given !== '' && sha256(given) === stored.sha256;
  return process.env.NODE_ENV !== 'production'; // alleen lokaal zonder sleutel
}

interface Body {
  naam?: string;
  plaats?: string;
  telefoon?: string;
  /** YYYY-MM-DD, het deal-veld "Datum uitvoering"; leeg = nog geen datum. */
  datumUitvoering?: string | null;
  /** Teamleader quotations.info (data), of… */
  quotation?: Parameters<typeof linesFromQuotation>[0];
  /** …de regels al plat. */
  lines?: PlanningLineInput[];
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is geen JSON' }, { status: 400 });
  }
  const lines = body.lines ?? (body.quotation ? linesFromQuotation(body.quotation) : null);
  if (!body.naam || !Array.isArray(lines)) {
    return NextResponse.json(
      { ok: false, error: 'naam en quotation (of lines) zijn verplicht' },
      { status: 400 },
    );
  }

  const job = planningJob({ naam: body.naam, plaats: body.plaats ?? '', lines });
  const target = planningTarget(body.datumUitvoering);
  return NextResponse.json({
    ok: true,
    target,
    rows: sheetRows(job, body.telefoon?.trim() ?? '', target.layout),
    overigWerk: job.overigWerk,
    floors: job.floors.length,
  });
}
