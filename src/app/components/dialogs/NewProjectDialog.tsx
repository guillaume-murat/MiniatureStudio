import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';

/** Names a new project before creating it; it starts with an empty brief panel. */
export function NewProjectDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'newProject');
  const close = useUI((s) => s.close);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  async function create() {
    setBusy(true);
    await useWorkspace.getState().newProject(name.trim() || undefined);
    setBusy(false);
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('newProject.title')}</DialogTitle>
            <DialogDescription>{t('newProject.description')}</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('topbar.untitled')} aria-label={t('newProject.name')} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('newProject.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
