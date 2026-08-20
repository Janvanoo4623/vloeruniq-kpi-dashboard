// Gedeelde UI-bouwstenen. Eén kaarttaal, één badge-taal, één sectiekop — zodat
// elke pagina er hetzelfde uitziet zonder dat we per pagina Tailwind herhalen.
import type { ReactNode } from 'react';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ── Kaart ────────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-hair px-5 py-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

/** Kaart met kop + body in één — de vorm die de meeste panelen gebruiken. */
export function Panel({
  title,
  subtitle,
  right,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} right={right} />
      <CardBody className={bodyClassName}>{children}</CardBody>
    </Card>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────
type BadgeTone = 'good' | 'warn' | 'crit' | 'accent' | 'oak' | 'neutral';

const BADGE_TONES: Record<BadgeTone, string> = {
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  crit: 'bg-crit-soft text-crit',
  accent: 'bg-accent-soft text-accent',
  oak: 'bg-oak-soft text-oak',
  neutral: 'bg-sunk text-ink-soft',
};

export function Badge({
  tone = 'neutral',
  className,
  title,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Paginakop ────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-mute">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Stille scheiding binnen een pagina — een sectie boven een rij kaarten. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
        {children}
      </h2>
      {right}
    </div>
  );
}

// ── Knoppen ──────────────────────────────────────────────────────────────
const BUTTON_VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent/90 shadow-sm',
  secondary: 'border border-line bg-surface text-ink-soft hover:text-ink hover:border-ink-faint',
  ghost: 'text-ink-mute hover:text-ink hover:bg-sunk',
} as const;

export function Button({
  variant = 'secondary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

// ── Lege staat ───────────────────────────────────────────────────────────
export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-10 text-[13px] text-ink-faint', className)}>
      {children}
    </div>
  );
}
