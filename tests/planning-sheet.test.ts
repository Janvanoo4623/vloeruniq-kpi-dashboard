// Planning-Sheet: offerteregels → de rijen die Jan in "Planning '26" overtypt.
// Elk voorbeeld is een echte offerte, met daarnaast wat Jan zelf in de Sheet
// typte (export 2026-11-19). Zie docs/PLANNING-SHEET.md.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planningJob, planningTarget, sheetRows, linesFromQuotation } from '../lib/planning-sheet';

const regel = (description: string, quantity: number, amount: number) => ({ description, quantity, amount });

test('planning: zelfde vloer per verdieping blijft twee rijen, plint van €0 komt in M (Somhorst, offerte 1104)', () => {
  // Jan: 46 [BG] P530 Warm Beige ; 46 [1e] P530 Warm Beige | M: 90x12 RAL9010
  const job = planningJob({
    naam: 'Koen Somhorst',
    plaats: 'Haaksbergen',
    lines: [
      regel('PVC Stroken P530 Warm Beige | Incl. 10% snijverlies | Incl. egaliseren, lijmen en leggen', 46, 2242.97),
      regel('PVC Stroken P530 Warm Beige | Incl. 10% snijverlies | Incl. egaliseren, lijmen en leggen', 46, 2242.97),
      regel('MDF Plint 90x12 gelakt wit RAL9010 | Incl. zaagverlies | Incl. montage | Prijs per m1', 0, 0),
      regel('Regiokorting', 1, -353.72),
    ],
  });
  assert.deepEqual(job.floors, [
    { m2: 46, k: '', vloer: 'PVC Stroken P530 Warm Beige' },
    { m2: 46, k: '', vloer: 'PVC Stroken P530 Warm Beige' },
  ]);
  assert.equal(job.plintTrapMat, 'MDF Plint 90x12 gelakt wit RAL9010');
});

test('planning: plint met aantal plus dezelfde plint met €0 telt één keer (Evcimen)', () => {
  const job = planningJob({
    naam: 'Gul Evcimen',
    plaats: 'Bathmen',
    lines: [
      regel('PVC Visgraat VT Wonen Herringbone Warm Naturel | Incl. 10% snijverlies | Incl. egaliseren,lijmen en leggen', 102, 5647.93),
      regel('Sleuven dichtzetten (tbv vloerverwarming)', 148, 0),
      regel('MDF Plint 90x15  wit Ral 9010 | incl. zaagverlies | incl. montage', 83.3, 1511.1),
      regel('MDF Plint 90x15  wit Ral 9010 | incl. zaagverlies | incl. montage', 0, 0),
    ],
  });
  assert.equal(job.plintTrapMat, '83,3m1 MDF Plint 90x15 wit Ral 9010');
  assert.deepEqual(job.overigWerk, ['148 × Sleuven dichtzetten (tbv vloerverwarming)']);
});

test('planning: trap, plinten en mat in M; tapijttrap is geen vloer (Ripperda, offerte 1182)', () => {
  // Jan: Plint 90x12RAL9010 34m1 | Traprenovatie tapijt touch of cashmere 72 | plint 70x12 24m1 | Entreematten
  const job = planningJob({
    naam: 'J Ripperda',
    plaats: 'Wesepe',
    lines: [
      regel('PVC Visgraat Herringbone VT Wonen Warm Natural | Incl. 10% snijverlies | Incl. egaliseren,lijmen en leggen', 77, 4263.64),
      regel('Traprenovatie tapijt Touch of Cashmere 72 | incl. tapijt | Excl zijkanten trap bekleden', 1, 991.74),
      regel('MDF Plint 90x12 gelakt wit RAL9010 | Incl. zaagverlies | Incl. montage | Prijs per m1', 34, 560.58),
      regel('Entreemat Castell Classic | 85,- per m2 | Prijs op nacalculatie', 0, 0),
    ],
  });
  assert.equal(job.floors.length, 1);
  assert.equal(
    job.plintTrapMat,
    'Traprenovatie tapijt Touch of Cashmere 72 | 34m1 MDF Plint 90x12 gelakt wit RAL9010 | Entreemat Castell Classic',
  );
  assert.deepEqual(job.parts.map((p) => p.kind), ['trap', 'plint', 'mat']);
});

test('planning: vloer zonder legservice gaat naar K, niet naar J (telt niet mee in het maandtotaal)', () => {
  const job = planningJob({
    naam: 'X',
    plaats: 'Y',
    lines: [regel('Klik PVC P440 Natural Oak | Alleen leveren', 50, 1500)],
  });
  assert.deepEqual(job.floors, [{ m2: null, k: '50', vloer: 'Klik PVC P440 Natural Oak' }]);
});

test('planning: plaats in de Sheet volgt de datum uitvoering', () => {
  assert.deepEqual(planningTarget('2026-12-07'), { tab: 'Dec 26', block: 'Overig', layout: 'maand' });
  assert.deepEqual(planningTarget('2026-09-01'), { tab: 'Sept 26', block: 'Overig', layout: 'maand' });
  assert.deepEqual(planningTarget('2027-03-01'), { tab: '2027', block: 'Overig', layout: 'oud' });
  assert.deepEqual(planningTarget(''), { tab: 'Geen datum', block: null, layout: 'geenDatum' });
  assert.deepEqual(planningTarget(null), { tab: 'Geen datum', block: null, layout: 'geenDatum' });
});

test('planning: cellen per indeling — eerste rij met klantgegevens, vervolgrij alleen vloer', () => {
  const job = planningJob({
    naam: 'Markerink',
    plaats: 'Gelselaar',
    lines: linesFromQuotation({
      grouped_lines: [
        {
          line_items: [
            { description: 'PVC Tegels P360 Grey | Incl. 6% snijverlies | Incl. egaliseren, lijmen en leggen', quantity: 53, total: { tax_exclusive: { amount: 2715.7 } } },
            { description: 'PVC Tegels P360 Grey | Incl. 6% snijverlies | Incl. egaliseren, lijmen en leggen', quantity: 32, total: { tax_exclusive: { amount: 1639.67 } } },
            { description: 'Traprenovatie PVC dichte trap P360 Grey | Incl. montage | Prijs per trede', quantity: 13, total: { tax_exclusive: { amount: 1235.54 } } },
            { description: 'MDF Plint 90x12 gelakt zwart RAL9005 | Incl. zaagverlies | Incl. montage', quantity: 0, total: { tax_exclusive: { amount: 0 } } },
          ],
        },
      ],
    }),
  });
  assert.deepEqual(sheetRows(job, '0652427326', 'maand'), [
    {
      G: 'Markerink',
      H: 'Tel: 0652427326',
      I: 'Gelselaar',
      J: 53,
      L: 'PVC Tegels P360 Grey',
      M: 'Traprenovatie PVC dichte trap P360 Grey (13 treden) | MDF Plint 90x12 gelakt zwart RAL9005',
    },
    { J: 32, L: 'PVC Tegels P360 Grey' },
  ]);
  // Tab 2027 (oude indeling): plint en trap in eigen kolommen.
  const oud = sheetRows(job, '', 'oud')[0];
  assert.equal(oud.K, 'Traprenovatie PVC dichte trap P360 Grey (13 treden)');
  assert.equal(oud.J, 'MDF Plint 90x12 gelakt zwart RAL9005');
  assert.equal(oud.E, undefined);
});
