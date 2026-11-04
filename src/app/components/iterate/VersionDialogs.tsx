import { useRef } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { explainError } from '../../lib/errors';
import { historyOf, versionsAfter } from '../../lib/versions';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { Generation } from '../../lib/types';

interface DialogProps {
  gen: Generation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ConfirmDialog({ open, onOpenChange, title, description, action, destructive, onConfirm }: Omit<DialogProps, 'gen'> & { title: string; description: string; action: string; destructive?: boolean; onConfirm: () => Promise<unknown> }) {
  const t = useT();
  // Frozen while it closes: the version may be gone by then, or another one selected.
  const shown = useRef({ title, description, action });
  if (open) shown.current = { title, description, action };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown.current.title}</AlertDialogTitle>
          <AlertDialogDescription>{shown.current.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={() =>
              void onConfirm().catch((error) => {
                const info = explainError(error);
                toast.error(t(info.key), { description: info.message });
              })
            }
          >
            {shown.current.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Going back to a version deletes the newer ones for good: says how many. */
export function RevertDialog({ gen, ...dialog }: DialogProps) {
  const t = useT();
  const generations = useWorkspace((s) => s.generations);
  const revertTo = useWorkspace((s) => s.revertTo);
  return (
    <ConfirmDialog
      {...dialog}
      destructive
      title={t('versions.revertTitle')}
      description={t('versions.revertWarning', { n: versionsAfter(generations, gen.id).length })}
      action={t('versions.revert')}
      onConfirm={() => revertTo(gen.id)}
    />
  );
}

export function DuplicateDialog({ gen, ...dialog }: DialogProps) {
  const t = useT();
  const duplicateVersion = useWorkspace((s) => s.duplicateVersion);
  return <ConfirmDialog {...dialog} title={t('versions.duplicateTitle')} description={t('versions.duplicateHint')} action={t('versions.duplicate')} onConfirm={() => duplicateVersion(gen.id)} />;
}

export function RemoveThumbnailDialog({ gen, ...dialog }: DialogProps) {
  const t = useT();
  const generations = useWorkspace((s) => s.generations);
  const removeThumbnail = useWorkspace((s) => s.removeThumbnail);
  return (
    <ConfirmDialog
      {...dialog}
      destructive
      title={t('versions.removeThumbnailTitle')}
      description={t('versions.removeThumbnailWarning', { n: historyOf(generations, gen.id).length })}
      action={t('common.delete')}
      onConfirm={() => removeThumbnail(gen.id)}
    />
  );
}
