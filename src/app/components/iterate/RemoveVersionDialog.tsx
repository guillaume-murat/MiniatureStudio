import { useRef } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { explainError } from '../../lib/errors';
import { rootOf, versionsRemovedWith } from '../../lib/versions';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { Generation } from '../../lib/types';

/** Confirms removing a version: says what goes with it, as nothing brings it back. */
export function RemoveVersionDialog({ gen, open, onOpenChange }: { gen: Generation; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const generations = useWorkspace((s) => s.generations);
  const removeVersion = useWorkspace((s) => s.removeVersion);
  // Frozen while it closes: the version may be gone by then, or another one selected.
  const shown = useRef({ count: 0, original: false });
  if (open) shown.current = { count: versionsRemovedWith(generations, gen.id).length, original: rootOf(generations, gen.id)?.id === gen.id };
  const { count, original } = shown.current;
  const title = original ? t('versions.removeOriginal') : count > 1 ? t('versions.removeWithNext') : t('versions.removeOne');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{t('versions.removeCount', { n: count })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              void removeVersion(gen.id).catch((error) => {
                const info = explainError(error);
                toast.error(t(info.key), { description: info.message });
              })
            }
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
