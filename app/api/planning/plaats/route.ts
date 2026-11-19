// POST /api/planning/plaats — waar in de tab komen de rijen, en de batchUpdate
// voor Google Sheets. Tweede stap van de n8n-flow (docs/PLANNING-SHEET.md):
//   1. POST /api/planning        → target (tab, blok) + rows (cellen)
//   2. n8n leest die tab (spreadsheets.get, includeGridData, A1:M400)
//   3. POST /api/planning/plaats → requests; n8n stuurt die naar :batchUpdate
// Zuiver rekenen, geen database; zelfde sleutel als /api/planning.
import { NextResponse } from 'next/server';
import { placeRows, type GridCell, type SheetTarget } from '@/lib/planning-sheet';
import { authorized } from '@/lib/planning-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  /** Het antwoord van spreadsheets.get voor één tab (sheets[0]). */
  sheet?: {
    sheets?: { properties?: { sheetId?: number; title?: string }; data?: { rowData?: { values?: GridCell[] }[] }[] }[];
  };
  target?: SheetTarget;
  rows?: Record<string, string | number>[];
  quotationId?: string;
  offerteNaam?: string;
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
  const tab = body.sheet?.sheets?.[0];
  const sheetId = tab?.properties?.sheetId;
  if (sheetId == null || !body.target || !Array.isArray(body.rows) || !body.rows.length || !body.quotationId) {
    return NextResponse.json(
      { ok: false, error: 'sheet (met sheetId), target, rows en quotationId zijn verplicht' },
      { status: 400 },
    );
  }
  const grid = (tab?.data?.[0]?.rowData ?? []).map((r) => r.values ?? []);
  const result = placeRows({
    grid,
    sheetId,
    target: body.target,
    rows: body.rows,
    quotationId: body.quotationId,
    offerteNaam: body.offerteNaam ?? '',
  });
  return NextResponse.json({ ok: true, tab: tab?.properties?.title, ...result });
}
