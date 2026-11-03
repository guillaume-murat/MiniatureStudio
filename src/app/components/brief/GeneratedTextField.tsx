import { Field } from '../Section';
import { PromptCode } from './PromptCode';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { textLine } from '../../lib/prompt';
import { findStyle } from '../../lib/styles';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { PromptOptions } from '../../lib/types';

/** Whether the model may write text in the image. A style that adds text needs it: « Aucun » is then locked. */
export function GeneratedTextField() {
  const t = useT();
  const { brief, setBrief, promptOptions, customStyles } = useWorkspace();
  const locked = findStyle(brief.styleId, customStyles)?.preset?.text === 'style';
  const text = promptOptions().text;
  return (
    <Field label={t('promptOptions.text')} hint={locked ? t('promptOptions.textLocked') : t('promptOptions.presetHint')}>
      <ToggleGroup
        type="single"
        variant="outline"
        className="w-full"
        value={text}
        onValueChange={(v) => v && setBrief({ options: { ...brief.options, text: v as PromptOptions['text'] } })}
      >
        <ToggleGroupItem value="none" disabled={locked} className="flex-1 text-xs">{t('promptOptions.textNone')}</ToggleGroupItem>
        <ToggleGroupItem value="style" className="flex-1 text-xs">{t('promptOptions.textStyle')}</ToggleGroupItem>
      </ToggleGroup>
      <PromptCode text={textLine(text)} />
    </Field>
  );
}
