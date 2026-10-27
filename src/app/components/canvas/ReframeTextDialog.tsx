import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { useUI } from '../../stores/ui';
import { useText } from '../../stores/text';
import { selectedGeneration, useWorkspace } from '../../stores/workspace';
import { isArrow, isVisible, type LayerBlock } from '../../lib/textBlocks';
import { useT } from '../../i18n';

/** Text and arrows on the selected image that aren't part of its pixels: being edited, or saved as an editable layer. */
function pendingBlocks(): LayerBlock[] {
  const ws = useWorkspace.getState();
  if (ws.textMode) return useText.getState().blocks.filter(isVisible);
  return selectedGeneration(ws)?.textLayer?.blocks ?? [];
}

/** The reframe tool toggle: asks first what to do with pending text and arrows. */
export function toggleReframe() {
  const ws = useWorkspace.getState();
  if (ws.reframeMode || !ws.selectedId) return ws.setReframeMode(false);
  if (pendingBlocks().length) useUI.getState().open('reframeText');
  else ws.setReframeMode(true);
}

export function ReframeTextDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'reframeText');
  const close = useUI((s) => s.close);
  const [blocks, setBlocks] = useState<LayerBlock[]>([]);
  const [merge, setMerge] = useState({ text: true, arrows: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setBlocks(pendingBlocks());
      setMerge({ text: true, arrows: true });
    }
  }, [open]);

  const texts = blocks.filter((b) => !isArrow(b)).length;
  const arrows = blocks.length - texts;

  async function proceed(withMerge: { text: boolean; arrows: boolean }) {
    setBusy(true);
    const ws = useWorkspace.getState();
    const done = await ws.bakeText(blocks, withMerge);
    setBusy(false);
    close();
    if (done) ws.setReframeMode(true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reframe.pendingTitle')}</DialogTitle>
          <DialogDescription>{t('reframe.pendingDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {texts > 0 && (
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              {t('reframe.mergeText', { n: texts })}
              <Switch checked={merge.text} onCheckedChange={(text) => setMerge({ ...merge, text })} />
            </label>
          )}
          {arrows > 0 && (
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              {t('reframe.mergeArrows', { n: arrows })}
              <Switch checked={merge.arrows} onCheckedChange={(arrows) => setMerge({ ...merge, arrows })} />
            </label>
          )}
          <p className="text-xs text-muted-foreground">{t('reframe.pendingHint')}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => proceed(merge)} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {merge.text || merge.arrows ? t('reframe.mergeAndReframe') : t('reframe.keepAndReframe')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
