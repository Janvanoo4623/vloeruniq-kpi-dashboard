'use client';

import { Download } from 'lucide-react';
import { downloadCsv, toCsv, type CsvWaarde } from '@/lib/csv';

/**
 * Downloadknop voor de cijfers achter een tabel. Bewust naast de tabel en niet
 * één knop bovenaan de pagina: wat je exporteert moet zichtbaar hetzelfde zijn
 * als wat je ziet staan.
 */
export default function CsvKnop<T extends Record<string, CsvWaarde>>({
  rijen,
  kolommen,
  naam,
  label = 'CSV',
}: {
  rijen: T[];
  kolommen: { key: keyof T & string; label: string }[];
  naam: string;
  label?: string;
}) {
  if (rijen.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => downloadCsv(naam, toCsv(rijen, kolommen))}
      title={`${rijen.length} rijen downloaden als CSV`}
      className="no-print flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11.5px] font-medium text-ink-mute transition hover:text-ink"
    >
      <Download size={12} strokeWidth={2.2} />
      {label}
    </button>
  );
}
