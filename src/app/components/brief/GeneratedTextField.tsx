import { Field } from '../Section';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { textLine } from '../../lib/prompt';
import { useSettings } from '../../stores/settings';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { PromptOptions } from '../../lib/types';

/** Whether the model may write text in the image. Inserting a style that writes in the image turns it on, once. */
export function GeneratedTextField() {
  const t = useT();
  const sketchView = useWorkspace((s) => s.view === 'sketch');
  const lang = useSettings((s) => s.lang);
  const { brief, setBrief, promptOptions } = useWorkspace();
  const text = promptOptions().text;
  return (
    <Field label={t('promptOptions.text')} disabledReason={sketchView ? t('sketch.greyed') : undefined} prompt={textLine(lang, text)} hint={t('promptOptions.presetHint')}>
      <ToggleGroup
        type="single"
        variant="outline"
        className="w-full"
        value={text}
        onValueChange={(v) => v && setBrief({ options: { ...brief.options, text: v as PromptOptions['text'] } })}
      >
        <ToggleGroupItem value="none" className="flex-1 text-xs">{t('promptOptions.textNone')}</ToggleGroupItem>
        <ToggleGroupItem value="style" className="flex-1 text-xs">{t('promptOptions.textStyle')}</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}
