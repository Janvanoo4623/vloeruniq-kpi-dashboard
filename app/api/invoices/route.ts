// POST /api/invoices — handmatig openstaand bedrag op een deels betaalde
// factuur. Sessie-gated door proxy.ts.
//
// Teamleader kent alleen betaald of niet betaald, dus een aanbetaling laat de
// hele factuur openstaan. Dit is de enige plek waar een mens dat kan bijstellen.
import { NextResponse } from 'next/server';
import { getInvoiceAdjustments, setInvoiceAdjustment } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

export async function GET() {
  return NextResponse.json({ ok: true, adjustments: await getInvoiceAdjustments() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      openIncl?: number | null;
      note?: string;
    };
    const id = String(body.id ?? '').trim();
    if (!id) return bad('Geen factuur opgegeven.');

    // null = correctie wissen; anders een bedrag van nul of meer.
    let openIncl: number | null = null;
    if (body.openIncl != null) {
      openIncl = Number(body.openIncl);
      if (!Number.isFinite(openIncl) || openIncl < 0) return bad('Ongeldig bedrag.');
    }

    const adjustments = await setInvoiceAdjustment(id, openIncl, body.note);
    return NextResponse.json({ ok: true, adjustments });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
