import { useEffect, useState } from 'react';
import { Check, ScanFace } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { Persona } from '../../lib/types';
import { cn } from '../../lib/utils';

function PersonaOption({ persona, checked, onToggle }: { persona: Persona; checked: boolean; onToggle: () => void }) {
  const front = persona.photos.find((p) => p.slot === 'front') ?? persona.photos[0];
  const url = useBlobUrl(front?.blob);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors hover:bg-accent',
        checked && 'border-primary bg-primary/10',
      )}
    >
      {url ? <img src={url} alt="" className="aspect-square w-full rounded-md object-cover" /> : <div className="aspect-square w-full rounded-md bg-muted" />}
      <span className="w-full truncate text-xs font-medium">{persona.name}</span>
      <span className="text-[10px] text-muted-foreground">{persona.photos.length} photo{persona.photos.length > 1 ? 's' : ''}</span>
      {checked && (
        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}

/** Pick the registered people whose faces should be restored on the selected image. */
export function FaceFixDialog({ open, onOpenChange, onStarted }: { open: boolean; onOpenChange: (open: boolean) => void; onStarted?: () => void }) {
  const t = useT();
  const { personas, personaIds, fixFaces } = useWorkspace();
  const [picked, setPicked] = useState<string[]>([]);

  // Start from the people already selected for the brief: they are likely in the image.
  useEffect(() => {
    if (open) setPicked(personaIds.filter((id) => personas.some((p) => p.id === id)));
  }, [open, personaIds, personas]);

  const toggle = (id: string) => setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('iterate.fixFace')}</DialogTitle>
          <DialogDescription>{t('iterate.fixFaceDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[50dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {personas.map((p) => (
            <PersonaOption key={p.id} persona={p} checked={picked.includes(p.id)} onToggle={() => toggle(p.id)} />
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!picked.length}
            onClick={() => {
              onOpenChange(false);
              fixFaces(picked);
              onStarted?.();
            }}
          >
            <ScanFace /> {t('iterate.fixFaceRun', { n: picked.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
