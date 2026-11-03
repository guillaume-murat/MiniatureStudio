import { Button } from '../ui/button';
import { PromptCode } from './PromptCode';
import { NO_STYLE_EMOJI, findStyle } from '../../lib/styles';
import { styleLine } from '../../lib/prompt';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { useUI } from '../../stores/ui';
import { useT } from '../../i18n';

/** The project's style; choosing one happens in the style library. */
export function StylePicker() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const styleId = useWorkspace((s) => s.brief.styleId);
  const customStyles = useWorkspace((s) => s.customStyles);
  const people = useWorkspace((s) => s.personaIds.length);
  const open = useUI((s) => s.open);
  const current = findStyle(styleId, customStyles);

  return (
    <>
      <Button variant="outline" className="w-full justify-start gap-2 font-normal" onClick={() => open('styles')}>
        <span aria-hidden>{current?.emoji ?? NO_STYLE_EMOJI}</span>
        <span className="truncate">{current ? current.name[lang] : t('brief.styleNone')}</span>
        {current && <span className="ml-auto truncate text-xs text-muted-foreground">{current.hint[lang]}</span>}
      </Button>
      <PromptCode text={styleLine(current?.prompt, people)} />
    </>
  );
}
