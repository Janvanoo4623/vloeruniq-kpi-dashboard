// Default price map (purchase price ex VAT per m²), ported from the Apps
// Script's DEFAULT_PRICE_MAP. Editable at runtime via store.getConfig/setConfig.
// See docs/DATA-MODEL.md.

import type { PriceMapEntry } from '../types';

export const DEFAULT_PRICE_MAP: PriceMapEntry[] = [
  // PVC Tegels 0.55
  { match: 'P310', price: 11.5 },
  { match: 'P320', price: 11.5 },
  { match: 'P330', price: 11.5 },
  { match: 'P340', price: 11.5 },
  { match: 'P360', price: 11.5 },
  { match: 'P370', price: 11.5 },
  // PVC Tegels XL 0.55
  { match: 'P321', price: 10.0 },
  { match: 'P341', price: 10.0 },
  { match: 'P361', price: 10.0 },
  { match: 'P371', price: 10.0 },
  // Klik PVC Tegels 0.55
  { match: 'P315', price: 18.35 },
  { match: 'P325', price: 18.35 },
  { match: 'P335', price: 18.35 },
  { match: 'P345', price: 18.35 },
  { match: 'P365', price: 18.35 },
  { match: 'P375', price: 18.35 },
  // PVC Stroken 0.55
  { match: 'P400', price: 10.85 },
  { match: 'P410', price: 10.85 },
  { match: 'P420', price: 10.85 },
  { match: 'P430', price: 10.85 },
  { match: 'P440', price: 10.85 },
  { match: 'P470', price: 10.85 },
  { match: 'P490', price: 10.85 },
  { match: 'P500', price: 10.85 },
  { match: 'P510', price: 10.85 },
  { match: 'P530', price: 10.85 },
  // PVC Stroken 0.30
  { match: 'P450', price: 7.95 },
  { match: 'P460', price: 7.95 },
  // PVC Stroken 0.55 LooseLay
  { match: 'P509', price: 26.47 },
  // Klik PVC Stroken 0.55
  { match: 'P405', price: 17.95 },
  { match: 'P415', price: 17.95 },
  { match: 'P425', price: 17.95 },
  { match: 'P435', price: 17.95 },
  { match: 'P445', price: 17.95 },
  { match: 'P495', price: 17.95 },
  // Klik PVC Stroken 0.30
  { match: 'P455', price: 16.5 },
  { match: 'P465', price: 16.5 },
  // PVC Visgraat 0.55
  { match: 'P590', price: 11.85 },
  { match: 'P600', price: 11.85 },
  { match: 'P602', price: 11.85 },
  { match: 'P610', price: 11.85 },
  { match: 'P620', price: 11.85 },
  { match: 'P640', price: 11.85 },
  { match: 'P700', price: 11.85 },
  { match: 'P710', price: 11.85 },
  { match: 'P730', price: 11.85 },
  // Klik PVC Visgraat 0.55
  { match: 'P595', price: 24.98 },
  { match: 'P605', price: 24.98 },
  { match: 'P615', price: 24.98 },
  { match: 'P625', price: 24.98 },
  { match: 'P645', price: 24.98 },
  { match: 'P705', price: 24.98 },
  { match: 'P715', price: 24.98 },
  { match: 'P735', price: 24.98 },
  // Hongaarse/Weense punt 0.55
  { match: 'P603', price: 14.25 },
  { match: 'P623', price: 14.25 },
  // VT Wonen - met prefix (langste eerst voor goede match volgorde)
  { match: 'VT Wonen Herringbone Klik', price: 24.98 },
  { match: 'VT Wonen Wide Board Klik', price: 23.94 },
  { match: 'VT Wonen Herringbone', price: 15.95 },
  { match: 'VT Wonen Wide Board', price: 15.95 },
  { match: 'VT Wonen Basic', price: 14.97 },
  // VT Wonen - zonder prefix maar met context (alternatieve benamingen)
  { match: 'herringbone warm naturel', price: 15.95 },
  { match: 'herringbone warm natural', price: 15.95 },
  { match: 'wide board warm naturel', price: 15.95 },
  { match: 'wide board warm natural', price: 15.95 },
  { match: 'basic sand', price: 14.97 },
];

export interface PriceConfig {
  /** "P620" -> 11.85 */
  pNumbers: Record<string, number>;
  /** [{ name: 'vt wonen herringbone klik', label: 'VT Wonen Herringbone Klik', price: 24.98 }, ...] longest-first */
  nameMatches: { name: string; label: string; price: number }[];
}

/** Build the lookup structure used by the matcher (mirrors loadPriceMapFromConfig). */
export function buildPriceConfig(entries: PriceMapEntry[]): PriceConfig {
  const pNumbers: Record<string, number> = {};
  const nameMatches: { name: string; label: string; price: number }[] = [];

  for (const entry of entries) {
    const key = String(entry.match).trim();
    const price = Number(entry.price);
    if (!key || !Number.isFinite(price)) continue;

    const upper = key.toUpperCase();
    if (/^P\d{3}$/.test(upper)) {
      pNumbers[upper] = price;
    } else {
      nameMatches.push({ name: key.toLowerCase(), label: key, price });
    }
  }

  // Longest name first so "VT Wonen Herringbone Klik" wins over "VT Wonen Herringbone".
  nameMatches.sort((a, b) => b.name.length - a.name.length);
  return { pNumbers, nameMatches };
}
