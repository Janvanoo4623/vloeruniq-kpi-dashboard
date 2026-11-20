// Settings API — read/edit date-effective prices, cost settings, and excluded
// quotation IDs. Session-gated by proxy.ts. Edits insert new effective-dated
// rows (non-retroactive) or toggle exclusions.
import { NextResponse } from 'next/server';
import {
  getCurrentPrices,
  getCurrentCosts,
  listExclusions,
  addPrice,
  getPriceRows,
  addCost,
  addExclusion,
  removeExclusion,
  getAppSetting,
  setAppSetting,
} from '@/lib/db';
import { DEFAULT_KPI_SETTINGS, parseKpiSettings } from '@/lib/kpi-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function currentState() {
  const [prices, costs, exclusions, kpiRaw] = await Promise.all([
    getCurrentPrices(),
    getCurrentCosts(),
    listExclusions(),
    getAppSetting('kpi', DEFAULT_KPI_SETTINGS),
  ]);
  return { prices, costs, exclusions, kpi: parseKpiSettings(kpiRaw) };
}

export async function GET() {
  return NextResponse.json(await currentState());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const bad = (msg: string) => NextResponse.json({ ok: false, error: msg }, { status: 400 });

  try {
    // Ingangsdatum: leeg = vandaag (de server vult hem in). De keuze staat in
    // Instellingen boven de tabel; 2000-01-01 betekent 'met terugwerkende
    // kracht', want dat ligt ruim vóór de oudste offerte.
    let effectiveFrom: string | undefined;
    let melding: string | undefined;
    if (body.effectiveFrom != null) {
      effectiveFrom = String(body.effectiveFrom).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return bad('Ongeldige ingangsdatum.');
    }

    switch (body.type) {
      case 'price': {
        const code = String(body.code ?? '').trim();
        const price = Number(body.price);
        if (!code || !Number.isFinite(price) || price < 0) return bad('Ongeldige prijs of code.');
        // Een EERSTE prijs voor een product bestond altijd al, hij was alleen niet
        // vastgelegd (zelfde regel als de snelinvoer op Controleren). "Vanaf vandaag"
        // liet alle bestaande offertes zonder prijs: Jan vulde op 2026-11-20 elf
        // overige producten zo in. Wie bewust een datum kiest, krijgt die datum.
        if (effectiveFrom == null) {
          const lower = code.toLowerCase();
          const bestaat = (await getPriceRows()).some((r) => r.code.trim().toLowerCase() === lower);
          if (!bestaat) {
            effectiveFrom = '2000-01-01';
            melding = 'Opgeslagen. Eerste prijs voor dit product: geldt ook voor oudere offertes.';
          }
        }
        await addPrice(code, price, effectiveFrom);
        break;
      }
      case 'cost': {
        const key = String(body.key ?? '').trim();
        const value = Number(body.value);
        if (!key || !Number.isFinite(value) || value < 0) return bad('Ongeldige waarde.');
        await addCost(key, value, effectiveFrom);
        break;
      }
      case 'kpi': {
        // Bewust door parseKpiSettings heen: onbekende of ongeldige waarden
        // vallen terug op de standaard in plaats van in de database te belanden.
        await setAppSetting('kpi', parseKpiSettings(body.settings));
        break;
      }
      case 'exclusion-add': {
        const id = String(body.id ?? '').trim();
        if (!id) return bad('Geen offerte-ID opgegeven.');
        await addExclusion(id, (body.reason as string) ?? null);
        break;
      }
      case 'exclusion-remove': {
        const id = String(body.id ?? '').trim();
        if (!id) return bad('Geen offerte-ID opgegeven.');
        await removeExclusion(id);
        break;
      }
      default:
        return bad('Onbekende actie.');
    }
    return NextResponse.json({ ok: true, ...(melding ? { melding } : {}), ...(await currentState()) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
