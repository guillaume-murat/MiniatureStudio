import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, ShieldCheck, TriangleAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Field } from '../Section';
import { useUI } from '../../stores/ui';
import { useSettings, type Theme } from '../../stores/settings';
import { useWorkspace, toastError } from '../../stores/workspace';
import { exportBackup, importBackup } from '../../lib/backup';
import { storageEstimate } from '../../lib/db';
import { resetApp } from '../../lib/reset';
import { downloadBlob } from '../../lib/images';
import { useT } from '../../i18n';

function formatBytes(n: number): string {
  if (n < 1e6) return `${Math.round(n / 1e3)} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e9).toFixed(1)} GB`;
}

export function SettingsDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'settings');
  const close = useUI((s) => s.close);
  const s = useSettings();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | 'reset' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) storageEstimate().then(setUsage);
  }, [open]);

  async function doExport() {
    setBusy('export');
    try {
      const blob = await exportBackup();
      downloadBlob(blob, `miniature-studio-backup-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File) {
    setBusy('import');
    try {
      await importBackup(file);
      await useWorkspace.getState().init();
      toast.success(t('settings.imported'));
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  async function doReset() {
    setBusy('reset');
    try {
      await resetApp();
    } catch (error) {
      setBusy(null);
      toastError(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-success" /> {t('settings.privacy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label={t('settings.appearance')}>
            <div className="flex flex-wrap gap-2">
              <ToggleGroup type="single" variant="outline" size="sm" className="min-w-52 flex-1" value={s.theme} onValueChange={(v) => v && s.set({ theme: v as Theme })}>
                {(['light', 'dark', 'system'] as const).map((v) => (
                  <ToggleGroupItem key={v} value={v} className="min-w-0 flex-1">
                    {t(`topbar.${v}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ToggleGroup type="single" variant="outline" size="sm" value={s.lang} onValueChange={(v) => v && s.set({ lang: v as 'en' | 'fr' })}>
                <ToggleGroupItem value="fr">FR</ToggleGroupItem>
                <ToggleGroupItem value="en">EN</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </Field>

          <Separator />

          <Field label={t('settings.data')} hint={usage ? t('settings.storage', { used: formatBytes(usage.usage), quota: formatBytes(usage.quota) }) : undefined}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={doExport} disabled={!!busy}>
                {busy === 'export' ? <Loader2 className="animate-spin" /> : <Download />} {t('settings.exportAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                {busy === 'import' ? <Loader2 className="animate-spin" /> : <Upload />} {t('settings.importAll')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) doImport(file);
                  e.target.value = '';
                }}
              />
            </div>
          </Field>

          <Field label={t('settings.reset')} hint={t('settings.resetHint')}>
            <Button variant="destructive" size="lg" className="w-full" onClick={() => setConfirmReset(true)} disabled={!!busy}>
              {busy === 'reset' ? <Loader2 className="animate-spin" /> : <TriangleAlert />} {t('settings.resetButton')}
            </Button>
          </Field>
        </div>
      </DialogContent>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-destructive" /> {t('settings.resetConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('settings.resetConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={doReset}>
              {t('settings.resetAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
