import type { ReactNode } from 'react';
import { Panel } from './ui';

/**
 * Paneel met een grafiek of tabel erin. Dunne wrapper om <Panel> zodat de
 * bestaande aanroepen (title/subtitle/action) blijven werken.
 */
export default function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      right={action}
      className={className}
      bodyClassName={bodyClassName}
    >
      {children}
    </Panel>
  );
}
