'use client';

import { useEffect } from 'react';

/**
 * Zet bij elke tabelcel de kolomnaam als data-label, zodat de CSS in
 * globals.css (".tabel-kaarten") een tabel op telefoonbreedte als kaartjes kan
 * tonen: eerste kolom als titel, de rest als "kolomnaam  waarde". Eén keer hier
 * in plaats van in ~25 tabellen apart; een MutationObserver houdt het bij als
 * een tabel na paginering of filteren nieuwe rijen krijgt.
 */
export default function TableLabels() {
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const label = () => {
      for (const table of Array.from(main.querySelectorAll('table'))) {
        const kopRij = table.querySelector('thead tr:last-child');
        if (!kopRij) continue;
        const koppen: string[] = [];
        for (const th of Array.from(kopRij.children) as HTMLElement[]) {
          const span = Number(th.getAttribute('colspan') ?? 1);
          for (let i = 0; i < span; i++) koppen.push((th.textContent ?? '').trim());
        }
        table.classList.add('tabel-kaarten');
        for (const tr of Array.from(table.querySelectorAll('tbody tr, tfoot tr'))) {
          let kol = 0;
          for (const td of Array.from(tr.children) as HTMLElement[]) {
            const l = koppen[kol] ?? '';
            if (td.getAttribute('data-label') !== l) td.setAttribute('data-label', l);
            kol += Number(td.getAttribute('colspan') ?? 1);
          }
        }
      }
    };
    label();
    let gepland = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(gepland);
      gepland = requestAnimationFrame(label);
    });
    obs.observe(main, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(gepland);
    };
  }, []);
  return null;
}
