'use client';

import { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import {
  DEFAULT_KPI_SETTINGS,
  LOST_DEFINITIONS,
  type KpiSettings,
  type LostDefinition,
} from '@/lib/kpi-settings';
import { Button, cn } from '@/components/ui';

/**
 * Hier stel je in hoe een cijfer wordt uitgerekend, niet wat het cijfer is.
 * De gekozen definitie verschijnt overal náást het getal dat eruit volgt — een
 * verborgen schakelaar waarmee je je eigen conversiecijfer kunt kiezen is precies
 * hoe je over een half jaar niet meer weet welk getal je leest.
 */
export default function KpiSettingsTab({ initial }: { initial: KpiSettings }) {
  const [settings, setSettings] = useState<KpiSettings>(initial);
  const [saved, setSaved] = useState<KpiSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'kpi', settings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessage(data.error || 'Opslaan mislukt.');
        return;
      }
      setSaved(settings);
      setMessage('Opgeslagen. Ververs de pagina om de cijfers bij te werken.');
    } catch {
      setMessage('Opslaan mislukt (netwerk).');
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof KpiSettings>(k: K, v: KpiSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[13px] font-semibold text-ink">Wat telt als verloren?</h3>
        <p className="mt-1 max-w-[68ch] text-[12.5px] text-ink-mute">
          Bepaalt de conversie en de winkans. Dit is geen voorkeur maar een definitie — de gekozen
          optie staat daarom overal in de app náást het getal dat eruit volgt.
        </p>

        <div className="mt-3 space-y-2">
          {LOST_DEFINITIONS.map((d) => {
            const active = settings.lostDefinition === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => set('lostDefinition', d.value as LostDefinition)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition',
                  active
                    ? 'border-accent/40 bg-accent-soft'
                    : 'border-line bg-surface hover:border-ink-faint',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    active ? 'border-accent bg-accent text-white' : 'border-line',
                  )}
                >
                  {active && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-[13px] font-semibold',
                      active ? 'text-accent' : 'text-ink',
                    )}
                  >
                    {d.label}
                    {d.value === DEFAULT_KPI_SETTINGS.lostDefinition && (
                      <span className="ml-2 font-medium text-ink-faint">aanbevolen</span>
                    )}
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-ink-mute">
                    {d.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {settings.lostDefinition === 'refused-only' && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-warn">
            <AlertTriangle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
            <span>
              Met deze keuze kwam de conversie op <strong>97,3%</strong> uit terwijl hij in
              werkelijkheid rond de <strong>45%</strong> ligt. Er staan maar 10 offertes op
              &ldquo;geweigerd&rdquo; tegenover 363 geaccepteerd, dus je meet vrijwel niets. Alleen
              kiezen als je bewust met de oude cijfers wilt vergelijken.
            </span>
          </p>
        )}
      </section>

      <section className="border-t border-hair pt-5">
        <h3 className="text-[13px] font-semibold text-ink">Drempels</h3>
        <div className="mt-3 space-y-3">
          <NumberRow
            label="Beslistermijn"
            value={settings.maturityDays}
            unit="dagen"
            hint="Na hoeveel dagen geldt een nog open offerte als beslist. Ter info: de helft van de gewonnen offertes was binnen 9 dagen rond, maar 24% duurde langer dan 30 dagen."
            min={7}
            max={365}
            onChange={(v) => set('maturityDays', v)}
          />
          <NumberRow
            label="Minimum waarnemingen"
            value={settings.minSample}
            unit="offertes"
            hint="Onder dit aantal tonen we geen percentage maar een streepje — een winkans over drie offertes is ruis."
            min={0}
            max={100}
            onChange={(v) => set('minSample', v)}
          />
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={settings.showExpiredInCharts}
            onChange={(e) => set('showExpiredInCharts', e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-line accent-accent"
          />
          <span className="text-[12.5px] text-ink-soft">
            Verlopen offertes tonen in de grafieken
            <span className="mt-0.5 block text-[11.5px] text-ink-faint">
              Alleen visueel — of ze meetellen in de conversie bepaal je hierboven.
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-hair pt-4">
        <Button variant="primary" onClick={save} disabled={!dirty || busy}>
          {busy ? 'Opslaan…' : 'Opslaan'}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setSettings(saved)} disabled={busy}>
            Ongedaan maken
          </Button>
        )}
        {message && <p className="text-[12.5px] text-ink-mute">{message}</p>}
      </div>
    </div>
  );
}

function NumberRow({
  label,
  value,
  unit,
  hint,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[12.5px] font-medium text-ink-soft">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v))));
          }}
          className="ml-auto w-20 rounded-lg border border-line px-2 py-1 text-right text-[13px] tabular-nums outline-none focus:border-accent"
        />
        <span className="w-[52px] shrink-0 text-[12px] text-ink-faint">{unit}</span>
      </div>
      <p className="mt-1.5 max-w-[62ch] text-[11.5px] leading-relaxed text-ink-faint">{hint}</p>
    </div>
  );
}
