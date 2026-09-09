'use client';

import { Printer } from 'lucide-react';

/**
 * De knop die de printdialoog opent. Staat bovenaan het rapport en verdwijnt op
 * papier — vandaar no-print.
 *
 * Bewust de printdialoog en geen PDF-generator: elke browser maakt hier een PDF
 * van met "Bewaar als PDF", en dat scheelt een bibliotheek van megabytes die we
 * anders alleen voor deze ene pagina zouden meeslepen.
 */
export default function PrintKnop() {
  return (
    <div className="no-print mb-5 flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
      <p className="text-[12.5px] text-ink-mute">
        Eén pagina per tabblad. Kies in de printdialoog <strong>Bewaar als PDF</strong>.
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
      >
        <Printer size={14} strokeWidth={2.2} />
        Afdrukken
      </button>
    </div>
  );
}
