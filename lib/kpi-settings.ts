// Instelbare KPI-definities.
//
// Waarom dit bestaat: "conversie" en "winkans" zijn geen natuurkundige grootheden
// maar keuzes. Telt een offerte die stilletjes verloopt als verloren? Vanaf hoeveel
// dagen beschouw je een open offerte als beslist? Onder hoeveel waarnemingen weiger
// je een percentage te tonen?
//
// De harde eis erbij: de actieve keuze staat altijd zichtbaar náást het getal
// (zie `definitionLabel`). Een verborgen schakelaar waarmee je je eigen
// conversiecijfer kunt kiezen is precies hoe je over een half jaar niet meer weet
// welk getal je leest.

/** Wat telt mee als 'verloren' in conversie en winkans. */
export type LostDefinition = 'expired-and-refused' | 'refused-only' | 'all-decided';

export interface KpiSettings {
  lostDefinition: LostDefinition;
  /** Dagen waarna een nog open offerte als beslist (en dus verloren) geldt. */
  maturityDays: number;
  /** Minimum aantal waarnemingen voordat we een percentage tonen. */
  minSample: number;
  /** Verlopen offertes meetellen in de omzetgrafieken (niet in conversie). */
  showExpiredInCharts: boolean;
}

export const DEFAULT_KPI_SETTINGS: KpiSettings = {
  // Standaard is de eerlijke: verlopen offertes zijn niet gewonnen. De oude
  // berekening (alleen 'geweigerd') gaf 97,3% omdat er in 22 maanden maar 10
  // offertes als geweigerd zijn afgevinkt tegenover 363 geaccepteerd -- die
  // noemer was zo goed als leeg en mat dus niets.
  lostDefinition: 'expired-and-refused',
  maturityDays: 60,
  minSample: 10,
  showExpiredInCharts: true,
};

export const LOST_DEFINITIONS: {
  value: LostDefinition;
  label: string;
  description: string;
}[] = [
  {
    value: 'expired-and-refused',
    label: 'Verlopen én geweigerd',
    description:
      'Een offerte die afloopt is net zo goed niet gewonnen als een die de klant afwijst. Dit is het eerlijkste cijfer, maar eerder een ondergrens: "verlopen" is een vervaldatum in Teamleader, geen klantbeslissing, dus een deel is mogelijk alsnog gewonnen via een nieuwe offerte.',
  },
  {
    value: 'refused-only',
    label: 'Alleen geweigerd',
    description:
      'Zoals het vóór 20-08-2026 werd berekend. Waarschuwing: er staan maar 10 offertes op "geweigerd" in 22 maanden, dus deze noemer is vrijwel leeg en het percentage zegt niets over hoe het bedrijf loopt.',
  },
  {
    value: 'all-decided',
    label: 'Alles behalve nog open',
    description:
      'Verlopen, geweigerd én oude offertes die nog op "open" staan maar allang beslist zijn. Het strengste cijfer.',
  },
];

/** Korte omschrijving om náást het getal te zetten. */
export function definitionLabel(s: KpiSettings): string {
  switch (s.lostDefinition) {
    case 'refused-only':
      return 'alleen geweigerd telt als verloren';
    case 'all-decided':
      return 'alles behalve nog open telt als verloren';
    default:
      return 'verlopen én geweigerd tellen als verloren';
  }
}

/** Telt deze status als verloren, gegeven de gekozen definitie? */
export function countsAsLost(
  status: string,
  ageDays: number,
  s: KpiSettings,
): boolean {
  if (status === 'accepted') return false;
  switch (s.lostDefinition) {
    case 'refused-only':
      return status === 'refused';
    case 'all-decided':
      return status !== 'open' || ageDays >= s.maturityDays;
    default:
      return status === 'refused' || status === 'expired';
  }
}

/** Parse wat er uit de database komt, met terugval op de standaard. */
export function parseKpiSettings(raw: unknown): KpiSettings {
  const v = (raw ?? {}) as Partial<KpiSettings>;
  const valid = LOST_DEFINITIONS.some((d) => d.value === v.lostDefinition);
  return {
    lostDefinition: valid ? (v.lostDefinition as LostDefinition) : DEFAULT_KPI_SETTINGS.lostDefinition,
    maturityDays:
      Number.isFinite(v.maturityDays) && (v.maturityDays as number) > 0
        ? Math.round(v.maturityDays as number)
        : DEFAULT_KPI_SETTINGS.maturityDays,
    minSample:
      Number.isFinite(v.minSample) && (v.minSample as number) >= 0
        ? Math.round(v.minSample as number)
        : DEFAULT_KPI_SETTINGS.minSample,
    showExpiredInCharts:
      typeof v.showExpiredInCharts === 'boolean'
        ? v.showExpiredInCharts
        : DEFAULT_KPI_SETTINGS.showExpiredInCharts,
  };
}
