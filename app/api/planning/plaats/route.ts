// POST /api/planning/plaats — wat er met een klus in de Sheet moet gebeuren, en
// de batchUpdate voor Google Sheets. Tweede stap van de n8n-flow (docs/PLANNING-SHEET.md):
//   1. POST /api/planning        → target (tab, blok) + rows (cellen)
//   2. n8n leest de hele Sheet (spreadsheets.get, includeGridData, A1:M400 per tab)
//   3. POST /api/planning/plaats → actie + requests; n8n stuurt requests naar :batchUpdate
// actie: nieuw | verplaatst | al goed | niet gevonden | tab ontbreekt.
// mode "nieuw" bij quotation.accepted, "wijziging" bij deal.updated (dan nooit aanmaken).
// Zuiver rekenen, geen database; zelfde sleutel als /api/planning.
import { NextResponse } from 'next/server';
import { placeJob, type GridCell, type SheetTarget, type TabGrid } from '@/lib/planning-sheet';
import { authorized } from '@/lib/planning-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SheetsResponse = {
  sheets?: { properties?: { sheetId?: number; title?: string }; data?: { rowData?: { values?: GridCell[] }[] }[] }[];
};

interface Body {
  /** spreadsheets.get met alle tabs (includeGridData). */
  spreadsheet?: SheetsResponse;
  target?: SheetTarget;
  rows?: Record<string, string | number>[];
  quotationId?: string;
  dealId?: string;
  offerteNaam?: string;
  mode?: 'nieuw' | 'wijziging';
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
  const tabs: TabGrid[] = (body.spreadsheet?.sheets ?? [])
    .filter((s) => s.properties?.sheetId != null && s.properties?.title)
    .map((s) => ({
      sheetId: s.properties!.sheetId!,
      title: s.properties!.title!,
      grid: (s.data?.[0]?.rowData ?? []).map((r) => r.values ?? []),
    }));
  if (!tabs.length || !body.target || !Array.isArray(body.rows) || !body.rows.length || !body.quotationId) {
    return NextResponse.json(
      { ok: false, error: 'spreadsheet (met tabs), target, rows en quotationId zijn verplicht' },
      { status: 400 },
    );
  }
  const result = placeJob({
    tabs,
    target: body.target,
    rows: body.rows,
    quotationId: body.quotationId,
    dealId: body.dealId,
    offerteNaam: body.offerteNaam ?? '',
    mode: body.mode === 'wijziging' ? 'wijziging' : 'nieuw',
  });
  return NextResponse.json({ ok: true, ...result });
}
