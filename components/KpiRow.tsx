'use client';

import { Children, createContext, useContext, type ReactNode } from 'react';
import { Card, cn } from './ui';

/**
 * Een rij KPI's als één kaart met scheidingslijnen, in plaats van vier losse
 * kaarten met elk een eigen schaduw. Dezelfde cijfers, maar het leest als één
 * regel informatie en niet als een muur. KpiCard ziet via de context dat hij in
 * een rij staat en tekent dan zichzelf zonder kader.
 */
const InRow = createContext(false);
export const useInKpiRow = () => useContext(InRow);

export default function KpiRow({ children, className }: { children: ReactNode; className?: string }) {
  const n = Children.toArray(children).filter(Boolean).length;
  return (
    <InRow.Provider value={true}>
      <Card className={className}>
        <div
          className={cn(
            'grid grid-cols-2 [&>*]:border-hair',
            n >= 5 ? 'lg:grid-cols-5' : n === 4 ? 'lg:grid-cols-4' : n === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
            // Scheidingslijnen: verticaal op brede schermen, raster op smalle.
            'lg:divide-x lg:divide-hair max-lg:[&>*:nth-child(odd)]:border-r max-lg:[&>*:not(:nth-last-child(-n+2))]:border-b',
          )}
        >
          {children}
        </div>
      </Card>
    </InRow.Provider>
  );
}
