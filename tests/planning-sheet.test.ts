// Planning-Sheet: offerteregels → de rijen die Jan in "Planning '26" overtypt.
// Elk voorbeeld is een echte offerte, met daarnaast wat Jan zelf in de Sheet
// typte (export 2026-11-19). Zie docs/PLANNING-SHEET.md.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFloorLine, laborRuleOf } from '../lib/teamleader/matching';
import { planningJob, planningTarget, sheetRows, linesFromQuotation, placeRows, placeJob, findJob, layoutForTab, tabKey, type GridCell, type TabGrid } from '../lib/planning-sheet';

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
  assert.deepEqual(planningTarget('2026-12-07'), { tab: "Dec '26", tabKey: 'dec26', block: 'Overig', layout: 'maand' });
  assert.deepEqual(planningTarget('2026-09-01'), { tab: "Sept '26", tabKey: 'sept26', block: 'Overig', layout: 'maand' });
  assert.deepEqual(planningTarget('2027-03-01'), { tab: '2027', tabKey: '2027', block: 'Overig', layout: 'oud' });
  assert.deepEqual(planningTarget(''), { tab: 'Geen datum', tabKey: 'geendatum', block: null, layout: 'geenDatum' });
  assert.deepEqual(planningTarget(null), { tab: 'Geen datum', tabKey: 'geendatum', block: null, layout: 'geenDatum' });
  // De echte tab heet "Okt' 26" (apostrof verkeerd): de sleutel vindt hem toch.
  assert.equal(tabKey("Okt' 26"), planningTarget('2026-10-05').tabKey);
});

// Een maandtab in het klein: kop, week, Overig met één klus, totaal.
const t = (v: string) => ({ formattedValue: v, userEnteredValue: { stringValue: v } });
const grid = (sumTot: number) => {
  const g: GridCell[][] = [];
  g[0] = [t(''), t('Di'), t('Wo'), t('Do'), t('Vrij'), t('Opmerkingen'), t('Naam')];
  g[1] = [t('Week 45')];
  g[2] = [{}, {}, {}, {}, {}, {}, t('Wilbers'), {}, {}, { formattedValue: '83', userEnteredValue: { numberValue: 83 } }];
  g[3] = [t('Afspraken')];
  g[4] = [t('Overig')];
  g[5] = [{}, {}, {}, {}, {}, {}, t('Agema')];
  g[6] = [];
  g[7] = [];
  g[8] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, { userEnteredValue: { formulaValue: `=SUM(J3:J${sumTot})` } }];
  return g;
};
const doel = planningTarget('2026-11-20');
const rijen: Record<string, string | number>[] = [{ G: 'Nieuw', J: 50, L: 'P420' }, { J: 20, L: 'P420' }];

test('planning: nieuwe klus komt onder de laatste klus in Overig, als ingevoegde rijen', () => {
  const r = placeRows({ grid: grid(8), sheetId: 7, target: doel, rows: rijen, quotationId: 'q1', offerteNaam: 'Offerte 1' });
  assert.equal(r.alAanwezig, false);
  assert.equal(r.rij, 7); // onder Agema (rij 6)
  assert.deepEqual((r.requests[0] as any).insertDimension.range, { sheetId: 7, dimension: 'ROWS', startIndex: 6, endIndex: 8 });
  assert.equal((r.requests[0] as any).insertDimension.inheritFromBefore, true); // onder Agema, niet onder het label
  const naam = r.requests.find((q: any) => q.updateCells?.start.columnIndex === 6) as any;
  assert.match(naam.updateCells.rows[0].values[0].note, /teamleader:q1/);
  assert.deepEqual(r.waarschuwingen, []);
});

test('planning: totaal stopt vóór de vrije plek → toch binnen het SUM-bereik (zoals in augustus)', () => {
  const r = placeRows({ grid: grid(6), sheetId: 7, target: doel, rows: rijen, quotationId: 'q1', offerteNaam: 'Offerte 1' });
  assert.equal(r.rij, 6); // SUM loopt t/m rij 6: invoegen op 6 schuift de grens mee
  assert.equal(r.waarschuwingen.length, 1);
});

test('planning: direct onder het bloklabel neemt de rij de opmaak van ónder over', () => {
  const g = grid(8);
  g[5] = [];
  const r = placeRows({ grid: g, sheetId: 7, target: doel, rows: rijen, quotationId: 'q2', offerteNaam: 'Offerte 2' });
  assert.equal(r.rij, 6);
  assert.equal((r.requests[0] as any).insertDimension.inheritFromBefore, false);
});

test('planning: dezelfde offerte nooit twee keer', () => {
  const g = grid(8);
  g[5][6] = { ...t('Agema'), note: 'Automatisch uit Teamleader (n8n): Offerte 9\nteamleader:q1' };
  const r = placeRows({ grid: g, sheetId: 7, target: doel, rows: rijen, quotationId: 'q1', offerteNaam: 'Offerte 1' });
  assert.equal(r.alAanwezig, true);
  assert.equal(r.rij, 6);
  assert.deepEqual(r.requests, []);
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

// ── Verplaatsen bij een gewijzigde datum uitvoering ──────────────────────

/** Nov met een klus die n8n schreef (2 rijen) + opmerking; Dec leeg onder Overig. */
const tabs = (): TabGrid[] => {
  const nov = grid(8);
  nov[5] = [{}, {}, {}, {}, {}, t('eerst egaliseren'), { ...t('Zonnebelt'), note: 'Automatisch uit Teamleader (n8n): Offerte 1151\nteamleader:q1\ndeal:d1\nrijen:2' }];
  nov[6] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, { formattedValue: '20', userEnteredValue: { numberValue: 20 } }];
  nov[7] = [{}, {}, {}, {}, {}, {}, t('Agema')]; // een andere klus direct eronder
  const dec = grid(8);
  dec[5] = [];
  return [
    { sheetId: 11, title: "Nov '26", grid: nov },
    { sheetId: 12, title: "Dec '26", grid: dec },
  ];
};
const zonnebelt: Record<string, string | number>[] = [{ G: 'Zonnebelt', J: 48.5, L: 'Visgraat' }, { J: 20, L: 'Stroken' }];

test('planning: klus wordt gevonden op de notitie, met precies zijn eigen rijen', () => {
  const f = findJob(tabs(), 'q1');
  assert.equal(f?.tab.title, "Nov '26");
  assert.equal(f?.start, 5);
  assert.equal(f?.count, 2); // Agema eronder hoort er niet bij
  assert.equal(findJob(tabs(), 'onbekend', 'd1')?.start, 5); // ook via de deal
  assert.equal(findJob(tabs(), 'onbekend'), null);
});

test('planning: datum naar december → nieuwe rijen in Dec onder Overig, oude rijen in Nov weg, opmerking mee', () => {
  const r = placeJob({ tabs: tabs(), target: planningTarget('2026-12-07'), rows: zonnebelt, quotationId: 'q1', dealId: 'd1', offerteNaam: 'Offerte 1151', mode: 'wijziging' });
  assert.equal(r.actie, 'verplaatst');
  assert.equal(r.van, "Nov '26");
  assert.equal(r.tab, "Dec '26");
  const ins = r.requests[0] as any;
  assert.equal(ins.insertDimension.range.sheetId, 12);
  const del = r.requests.at(-1) as any;
  assert.deepEqual(del.deleteDimension.range, { sheetId: 11, dimension: 'ROWS', startIndex: 5, endIndex: 7 });
  const opm = r.requests.find((q: any) => q.updateCells?.start.columnIndex === 5) as any;
  assert.equal(opm.updateCells.rows[0].values[0].userEnteredValue.stringValue, 'eerst egaliseren');
  const naam = r.requests.find((q: any) => q.updateCells?.start.columnIndex === 6) as any;
  assert.match(naam.updateCells.rows[0].values[0].note, /Verplaatst van Nov '26/);
  assert.match(naam.updateCells.rows[0].values[0].note, /rijen:2/);
});

test('planning: zelfde maand → niets; Jans eigen klus (geen notitie) → niets; geen datum → naar "Geen datum"', () => {
  const zelfde = placeJob({ tabs: tabs(), target: planningTarget('2026-11-30'), rows: zonnebelt, quotationId: 'q1', offerteNaam: 'x', mode: 'wijziging' });
  assert.equal(zelfde.actie, 'al goed');
  assert.deepEqual(zelfde.requests, []);
  const handwerk = placeJob({ tabs: tabs(), target: planningTarget('2026-12-07'), rows: zonnebelt, quotationId: 'jan-typte-dit', offerteNaam: 'x', mode: 'wijziging' });
  assert.equal(handwerk.actie, 'niet gevonden');
  const geen = placeJob({ tabs: tabs(), target: planningTarget(null), rows: zonnebelt, quotationId: 'q1', offerteNaam: 'x', mode: 'wijziging' });
  assert.equal(geen.actie, 'tab ontbreekt'); // in deze test bestaat "Geen datum" niet
  assert.deepEqual(geen.requests, []);
});

test('planning: kolomindeling volgt de tabnaam', () => {
  assert.equal(layoutForTab("Okt' 26"), 'maand');
  assert.equal(layoutForTab("Jun '26"), 'oud');
  assert.equal(layoutForTab('2027'), 'oud');
  assert.equal(layoutForTab('Geen datum'), 'geenDatum');
});

// ── Vloerherkenning (gedeeld met de sync) ───────────────────────────────

test('vloer: "Click PVC" zonder P-nummer is een vloer; "Zelf leggen" en "Exclusive installation" zijn zonder legservice', () => {
  assert.equal(isFloorLine('Click PVC Mist | Incl. 6% snijverlies'), true);
  assert.equal(isFloorLine('Click PVC Tegels VT Wonen Basic Natural | Incl. leggen click pvc'), true);
  assert.equal(laborRuleOf('Klik PVC | Kleur ntb | Zelf leggen'), 'excluded');
  assert.equal(laborRuleOf('Click PVC with integrated underlay | Exclusive installation click PVC'), 'excluded');
  // Ongewijzigd: gewoon "incl. leggen" blijft mét legservice.
  assert.equal(laborRuleOf('Klik PVC P440 | Incl. leggen'), 'included');
});
