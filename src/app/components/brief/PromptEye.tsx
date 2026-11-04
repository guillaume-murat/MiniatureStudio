import { useState } from 'react';
import { Eye } from 'lucide-react';
import { HoverCard } from 'radix-ui';
import { useT } from '../../i18n';

/** An eye that shows, on hover (or tap), the text a choice adds to the prompt. */
export function PromptEye({ text }: { text: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={80} closeDelay={0}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('brief.promptAdded')}
          className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded text-yellow-600 transition-colors hover:bg-yellow-500/15 dark:text-yellow-400"
        >
          <Eye className="size-3.5" />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        {/* No pointer events: it may cover the next eye, which must stay reachable. */}
        <HoverCard.Content
          side="right"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="pointer-events-none z-50 max-h-[85dvh] w-96 max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-yellow-500/40 bg-popover shadow-lg"
        >
          <div className="bg-yellow-500/10 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <p className="mb-1 font-sans font-medium text-foreground">{t('brief.promptAdded')}</p>
            <p className="whitespace-pre-wrap italic">{text || t('brief.promptNone')}</p>
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
