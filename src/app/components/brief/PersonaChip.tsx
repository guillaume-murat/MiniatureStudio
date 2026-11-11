import { Check } from 'lucide-react';
import { useBlobUrl } from '../../hooks/use-blob-url';
import type { Persona } from '../../lib/types';
import { cn } from '../../lib/utils';

export function PersonaChip({ persona, active, onToggle }: { persona: Persona; active: boolean; onToggle: () => void }) {
  const cover = persona.photos[0];
  const url = useBlobUrl(cover?.blob);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        // Raised like a toggle: pressed in when selected.
        'flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-background py-1 pr-3 pl-1 text-sm shadow-btn-sm transition-colors hover:bg-accent active:translate-x-px active:translate-y-px active:shadow-none',
        active && 'translate-x-px translate-y-px bg-primary/10 text-foreground shadow-pressed',
      )}
    >
      {url ? <img src={url} alt="" className="size-6 rounded-full object-cover" /> : <span className="size-6 rounded-full bg-muted" />}
      <span className="max-w-28 truncate">{persona.name}</span>
      {active && (
        <span className="flex size-4 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
