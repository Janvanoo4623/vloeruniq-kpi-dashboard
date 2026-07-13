'use client';

import type { PaymentStats } from '@/lib/payments';
import { formatPercent } from '@/lib/format';

const days = (v: number | null): string => (v == null ? '—' : `${v} d`);

export default function PaymentsCard({ payments }: { payments: PaymentStats }) {
  const noData = payments.sampleCount === 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Gem. betaaltermijn"
          value={days(payments.avgDaysToPay)}
          sub={noData ? 'nog geen betaaldata' : `${payments.sampleCount} facturen`}
          accent
        />
        <Stat label="Mediaan" value={days(payments.medianDaysToPay)} sub="typische factuur" />
        <Stat
          label="Op tijd betaald"
          value={payments.onTimePct == null ? '—' : formatPercent(payments.onTimePct)}
          sub="vóór vervaldatum"
        />
        <Stat
          label="Gem. leeftijd openstaand"
          value={days(payments.avgOutstandingAge)}
          sub={`${payments.outstandingCount} open`}
        />
      </div>

      {noData && (
        <p className="mt-3 text-xs text-amber-700">
          Nog geen betaaldata beschikbaar. Voeg de <code>paid_at</code>-kolom toe (zie
          schema.sql) en draai een synchronisatie om de betaaltermijn te vullen.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 ${accent ? 'bg-emerald-50' : 'bg-neutral-50'}`}>
      <div className="text-xs text-neutral-400">{label}</div>
      <div
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          accent ? 'text-emerald-700' : 'text-neutral-800'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-neutral-400">{sub}</div>
    </div>
  );
}
