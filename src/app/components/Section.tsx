import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-2.5', className)}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, children, htmlFor, className, required }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string; className?: string; required?: boolean }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
