import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { PromptText } from './PromptDialog';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useWorkspace, type EditPreview } from '../../stores/workspace';
import { imagePrice } from '../../lib/pricing';
import { useSettings } from '../../stores/settings';
import { useT, type TKey } from '../../i18n';
import type { ModelId } from '../../lib/types';

const MODEL_NAMES: Record<ModelId, TKey> = {
  'nano-banana-pro': 'brief.modelPro',
  'nano-banana-2': 'brief.model2',
  'nano-banana-2-lite': 'brief.modelLite',
};

function SentImage({ blob, label, position }: { blob: Blob; label: string; position: number }) {
  const url = useBlobUrl(blob);
  return (
    <li className="flex items-center gap-2 text-sm">
      <img src={url} alt="" className="h-10 w-16 shrink-0 rounded border object-cover" />
      <span className="min-w-0">
        <span className="font-medium">Image {position}</span> · {label}
      </span>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** What the next edit will send: the prompt, the images and whether it is limited to a painted area. */
export function EditPromptDialog({ open, onOpenChange, instruction }: { open: boolean; onOpenChange: (open: boolean) => void; instruction: string }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const previewEdit = useWorkspace((s) => s.previewEdit);
  const [preview, setPreview] = useState<EditPreview | null>(null);

  useEffect(() => {
    if (!open) return setPreview(null);
    let current = true;
    void previewEdit(instruction).then((result) => current && setPreview(result));
    return () => {
      current = false;
    };
  }, [open, instruction, previewEdit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('editPrompt.title')}</DialogTitle>
          <DialogDescription>{t('editPrompt.description')}</DialogDescription>
        </DialogHeader>
        {preview && (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact label={t('editPrompt.area')}>{preview.region ? t('editPrompt.areaPainted') : t('editPrompt.areaWhole')}</Fact>
              <Fact label={t('editPrompt.model')}>
                {t(MODEL_NAMES[preview.params.model])} · {preview.params.resolution} · {imagePrice(preview.params.model, preview.params.resolution, lang)}
              </Fact>
            </dl>
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium">{t('editPrompt.images', { n: preview.images.length })}</h4>
              <ul className="space-y-1.5">
                {preview.images.map((image, i) => (
                  <SentImage key={i} blob={image.blob} position={i + 1} label={image.person ?? t(image.role === 'marked' ? 'editPrompt.imageMarked' : 'editPrompt.imageCurrent')} />
                ))}
              </ul>
              {preview.peopleLeftOut && <p className="text-xs text-muted-foreground">{t('editPrompt.peopleLeftOut')}</p>}
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium">{t('editPrompt.prompt')}</h4>
              {!instruction.trim() && <p className="text-xs text-muted-foreground">{t('editPrompt.empty')}</p>}
              <PromptText text={preview.prompt} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
