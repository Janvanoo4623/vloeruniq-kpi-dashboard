// GET /api/quotation?id= — één volledig doorgerekende offerte.
//
// Bestaat omdat lijsten (zoals "zonder inkoopprijs" op Controleren) alleen een
// samenvatting per offerte meesturen. Wil je er dan één opengeklapt zien, dan is
// het goedkoper om die ene op te halen dan alle offertes mee te sturen naar de
// browser. Sessie-gated door proxy.ts.
import { NextResponse } from 'next/server';
import { getAllQuotations, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ ok: false, error: 'Geen offerte-ID.' }, { status: 400 });

  const [quotations, resolveInput] = await Promise.all([getAllQuotations(), getResolveInput()]);
  const rij = quotations.find((q) => q.id === id);
  if (!rij) return NextResponse.json({ ok: false, error: 'Offerte niet gevonden.' }, { status: 404 });

  const [quotation] = resolveQuotations([rij], resolveInput);
  return NextResponse.json({ ok: true, quotation });
}
