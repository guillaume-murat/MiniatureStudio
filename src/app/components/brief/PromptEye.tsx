import { useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { HoverCard } from 'radix-ui';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

/** An eye that shows, on hover (or tap), the text a choice adds to the prompt, or `children` under another `title`. */
export function PromptEye({
  text = '',
  title,
  side = 'right',
  onOpenChange,
  large,
  children,
}: {
  text?: string;
  title?: string;
  side?: 'right' | 'top';
  onOpenChange?: (open: boolean) => void;
  /** Beside a large button (Generate). */
  large?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const heading = title ?? t('brief.promptAdded');
  const [open, setOpen] = useState(false);
  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  return (
    <HoverCard.Root open={open} onOpenChange={change} openDelay={80} closeDelay={0}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={() => change(true)}
          aria-label={heading}
          className={cn('inline-flex shrink-0 cursor-help items-center justify-center rounded text-warning transition-colors hover:bg-highlight/15', large ? 'size-8' : 'size-5')}
        >
          <Eye className={large ? 'size-5' : 'size-3.5'} />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        {/* No pointer events, on its positioning wrapper too (tailwind.css): it may cover an eye, which must stay reachable. */}
        <HoverCard.Content
          side={side}
          align={side === 'top' ? 'end' : 'start'}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'prompt-eye-popup pointer-events-none z-50 max-h-[85dvh] max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border-[1.5px] border-ink bg-popover shadow-pop',
            children ? 'w-[40rem]' : 'w-96',
          )}
        >
          <div className="bg-highlight/10 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <p className="mb-1 font-sans font-medium text-foreground">{heading}</p>
            {children ?? <p className="whitespace-pre-wrap italic">{text || t('brief.promptNone')}</p>}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
