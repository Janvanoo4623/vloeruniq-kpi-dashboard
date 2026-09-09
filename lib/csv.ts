// CSV-uitvoer voor Excel, in het Nederlands.
//
// Twee dingen die het verschil maken tussen "opent netjes" en "één kolom met
// rommel": Excel gebruikt in een Nederlandse omgeving de puntkomma als scheiding
// en de komma als decimaalteken, en het bestand heeft een BOM nodig om é en ² te
// herkennen. Zonder die twee is elke export een klusje voor de ontvanger.

export type CsvWaarde = string | number | null | undefined;

const komma = (n: number): string => String(n).replace('.', ',');

function cel(v: CsvWaarde): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? komma(v) : '';
  // Puntkomma, aanhalingsteken of regeleinde in de tekst: quoten.
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rijen naar CSV-tekst. `kolommen` bepaalt volgorde én kopregel. */
export function toCsv<T extends Record<string, CsvWaarde>>(
  rijen: T[],
  kolommen: { key: keyof T & string; label: string }[],
): string {
  const kop = kolommen.map((k) => cel(k.label)).join(';');
  const body = rijen.map((r) => kolommen.map((k) => cel(r[k.key])).join(';'));
  return [kop, ...body].join('\r\n');
}

/** Downloadt de CSV in de browser. Alleen client-side aanroepen. */
export function downloadCsv(bestandsnaam: string, csv: string): void {
  // ﻿ = BOM. Zonder deze drie bytes leest Excel het bestand als ANSI en
  // wordt "m²" iets als "mÂ²".
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam.endsWith('.csv') ? bestandsnaam : `${bestandsnaam}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
