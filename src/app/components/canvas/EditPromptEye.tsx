import { useEffect, useState } from 'react';
import { PromptEye } from '../brief/PromptEye';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useWorkspace, type EditPreview } from '../../stores/workspace';
import { imagePrice } from '../../lib/models';
import { useSettings } from '../../stores/settings';
import { useT, type TKey } from '../../i18n';
import type { ModelId } from '../../lib/types';

const MODEL_NAMES: Record<ModelId, TKey> = {
  custom: 'brief.modelCustom',
  'gpt-image-2.5-sunburst': 'brief.modelGpt',
  'nano-banana-pro': 'brief.modelPro',
  'nano-banana-2': 'brief.model2',
  'nano-banana-2-lite': 'brief.modelLite',
};

function SentImage({ blob, label, position }: { blob: Blob; label: string; position: number }) {
  const t = useT();
  const url = useBlobUrl(blob);
  return (
    <li className="flex items-center gap-2">
      <img src={url} alt="" className="h-7 w-12 shrink-0 rounded border object-cover" />
      <span className="min-w-0">
        <span className="font-medium text-foreground">{t('editPrompt.imageNumber', { n: position })}</span> · {label}
      </span>
    </li>
  );
}

/** What the next edit will send, on hover of an eye: the prompt, the images and whether it is limited to a painted area. */
export function EditPromptEye({ instruction }: { instruction: string }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const previewEdit = useWorkspace((s) => s.previewEdit);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<EditPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!open) return setPreview(null);
    let current = true;
    previewEdit(instruction).then(
      (result) => current && setPreview(result),
      () => {
        if (!current) return;
        setPreview(null);
        setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [open, instruction, previewEdit]);

  return (
    <PromptEye title={t('editPrompt.title')} side="top" onOpenChange={setOpen}>
      {failed && <p className="font-sans">{t('editPrompt.unavailable')}</p>}
      {preview && (
        <div className="space-y-2 font-sans">
          <p>{preview.region ? t('editPrompt.areaPainted') : t('editPrompt.areaWhole')}</p>
          <p>
            {t('editPrompt.model', { name: preview.params.customModel || t(MODEL_NAMES[preview.params.model]) })} · {preview.params.resolution} · {imagePrice(preview.params.model, preview.params.resolution, lang, preview.params.quality)}
          </p>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{t('editPrompt.images', { n: preview.images.length })}</p>
            <ul className="space-y-1">
              {preview.images.map((image, i) => (
                <SentImage key={i} blob={image.blob} position={i + 1} label={image.person ?? t(image.role === 'marked' ? 'editPrompt.imageMarked' : 'editPrompt.imageCurrent')} />
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{t('editPrompt.prompt')}</p>
            {!instruction.trim() && <p>{t('editPrompt.empty')}</p>}
            <p className="font-mono whitespace-pre-wrap italic">{preview.prompt}</p>
          </div>
        </div>
      )}
    </PromptEye>
  );
}
