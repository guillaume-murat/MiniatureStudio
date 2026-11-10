import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { PromptEye } from './brief/PromptEye';
import { cn } from '../lib/utils';

export function Section({
  title,
  action,
  children,
  className,
  foldable,
  startFolded,
  prompt,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** The title folds and unfolds the section. */
  foldable?: boolean;
  startFolded?: boolean;
  /** The text this section adds to the prompt, behind an eye beside its title. */
  prompt?: string;
}) {
  const [open, setOpen] = useState(!startFolded);
  return (
    <section className={cn('space-y-2.5', className)}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 font-heading text-[15px] font-semibold text-foreground">
          {foldable ? (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 text-left">
              <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
              {title}
            </button>
          ) : (
            title
          )}
          {prompt !== undefined && <PromptEye text={prompt} />}
        </h3>
        {action}
      </div>
      {(!foldable || open) && children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
  required,
  prompt,
  disabledReason,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
  className?: string;
  required?: boolean;
  /** The text this input adds to the prompt, behind an eye beside its title. */
  prompt?: string;
  /** Greyed and not sent, keeping its value (the Gribouillis view), with why. */
  disabledReason?: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)} aria-disabled={disabledReason ? true : undefined}>
      <div className={cn('flex items-center gap-1', disabledReason && 'opacity-50')}>
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required && <span aria-hidden className="ml-1 text-destructive">*</span>}
        </label>
        {prompt !== undefined && !disabledReason && <PromptEye text={prompt} />}
      </div>
      {disabledReason ? (
        <fieldset disabled className="pointer-events-none space-y-1.5 opacity-50 select-none">
          {children}
        </fieldset>
      ) : (
        children
      )}
      {(disabledReason || hint) && <p className="text-xs text-muted-foreground">{disabledReason || hint}</p>}
    </div>
  );
}
