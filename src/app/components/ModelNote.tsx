import { useSettings } from '../stores/settings';
import { useWorkspace, type ImageCall } from '../stores/workspace';
import { modelNote, textModelNote } from '../lib/models';
import { useT } from '../i18n';
import { cn } from '../lib/utils';

/**
 * Where a prompt goes, in small: « Envoyé à Nano Banana 2 · Google Gemini ». `call` names an image
 * call (the store's `callParams` gives the model it is really sent with), `text` the text model
 * of the concept assistant and the ranking.
 */
export function ModelNote({ call, text, className }: { call?: ImageCall; text?: boolean; className?: string }) {
  const t = useT();
  // Read on each render: the model follows the settings and the selected image.
  useSettings();
  const provider = useSettings((s) => s.provider);
  const callParams = useWorkspace((s) => s.callParams);
  useWorkspace((s) => s.selectedId);
  const note = text ? textModelNote(provider) : modelNote(callParams(call ?? 'generate'));
  return <span className={cn('block text-[11px] text-muted-foreground', className)}>{t('modelNote.sentTo', { note })}</span>;
}
