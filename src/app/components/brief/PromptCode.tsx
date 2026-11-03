import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

const BLOCK = 'block w-full rounded-md border border-yellow-500/25 bg-yellow-500/10 px-2 py-1.5 text-left font-mono text-[11px] leading-relaxed text-muted-foreground';
const HEADING = 'font-sans font-medium text-foreground not-italic';
const TEXT = 'block whitespace-pre-wrap italic';

/**
 * A block of the prompt; nothing when it is empty. Folded to two lines until
 * clicked, or always `full` (inside something that is already clickable).
 */
export function PromptCode({ text, full, heading }: { text: string; full?: boolean; heading?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  if (full) {
    return (
      <code className={BLOCK}>
        <span className={cn('mb-1 block', HEADING)}>{heading ?? t('brief.promptAdded')}</span>
        <span className={TEXT}>{text}</span>
      </code>
    );
  }
  return (
    <button
      type="button"
      aria-expanded={open}
      // Selecting text to copy it is not a click on the block.
      onClick={() => !window.getSelection()?.toString() && setOpen(!open)}
      className={cn(BLOCK, 'cursor-pointer transition-colors select-text hover:bg-yellow-500/15')}
    >
      <span className={cn('mb-1 flex items-center gap-1', HEADING)}>
        <ChevronRight className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')} />
        {t('brief.promptAdded')}
      </span>
      <code className={cn(TEXT, !open && 'line-clamp-2')}>{text}</code>
    </button>
  );
}
