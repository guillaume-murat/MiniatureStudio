import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Field, Section } from '../Section';
import { Switch } from '../ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { PromptCode } from './PromptCode';
import { guidelinesLine, marginLine, priorityLine, textLine } from '../../lib/prompt';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { Guideline, PromptOptions, ResolvedPromptOptions } from '../../lib/types';
import { cn } from '../../lib/utils';

const GUIDELINES: Guideline[] = ['focal', 'background', 'colors', 'emotion'];
const WEIGHTS: ResolvedPromptOptions['brandWeight'][] = ['subtle', 'accents', 'dominant'];

/**
 * Settle what the prompt's blocks could otherwise contradict; starts from the chosen style's preset.
 * Folded by default, with the blocks it adds still shown so nothing is sent unseen.
 */
export function AdvancedOptions({ number }: { number: number }) {
  const t = useT();
  const { brief, setBrief, promptOptions } = useWorkspace();
  const options = promptOptions();
  const [open, setOpen] = useState(false);
  const set = (patch: PromptOptions) => setBrief({ options: { ...brief.options, ...patch } });
  const title = (
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 tracking-wide uppercase hover:text-foreground">
      <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
      {number}. {t('promptOptions.title')}
    </button>
  );

  if (!open) return <Section title={title}>{null}</Section>;

  return (
    <Section title={title}>
      <Field label={t('promptOptions.text')} hint={t('promptOptions.presetHint')}>
        <ToggleGroup type="single" variant="outline" className="w-full" value={options.text} onValueChange={(v) => v && set({ text: v as PromptOptions['text'] })}>
          <ToggleGroupItem value="none" className="flex-1 text-xs">{t('promptOptions.textNone')}</ToggleGroupItem>
          <ToggleGroupItem value="style" className="flex-1 text-xs">{t('promptOptions.textStyle')}</ToggleGroupItem>
        </ToggleGroup>
        <PromptCode text={textLine(options.text)} />
      </Field>

      <Field label={t('promptOptions.guidelines')} hint={t('promptOptions.presetHint')}>
        <div className="space-y-2">
          {GUIDELINES.map((g) => (
            <div key={g} className="flex items-center justify-between gap-3">
              <label htmlFor={`guideline-${g}`} className="text-sm">
                {t(`promptOptions.guideline.${g}`)}
              </label>
              <Switch id={`guideline-${g}`} checked={options.guidelines[g]} onCheckedChange={(on) => set({ guidelines: { ...brief.options?.guidelines, [g]: on } })} />
            </div>
          ))}
        </div>
        <PromptCode text={guidelinesLine(options.guidelines)} />
      </Field>

      <Field label={t('promptOptions.brandWeight')} hint={t('promptOptions.brandHint')}>
        <ToggleGroup type="single" variant="outline" className="w-full" value={options.brandWeight} onValueChange={(v) => v && set({ brandWeight: v as PromptOptions['brandWeight'] })}>
          {WEIGHTS.map((w) => (
            <ToggleGroupItem key={w} value={w} className="flex-1 px-1 text-xs">
              {t(`promptOptions.weights.${w}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field label={t('promptOptions.likeness')} hint={t('promptOptions.likenessHint')}>
        <ToggleGroup type="single" variant="outline" className="w-full" value={options.likeness} onValueChange={(v) => v && set({ likeness: v as PromptOptions['likeness'] })}>
          <ToggleGroupItem value="exact" className="flex-1 text-xs">{t('promptOptions.exact')}</ToggleGroupItem>
          <ToggleGroupItem value="style" className="flex-1 text-xs">{t('promptOptions.adapted')}</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field label={t('brief.promptAlways')}>
        <PromptCode text={`${marginLine()}\n\n${priorityLine()}`} />
      </Field>
    </Section>
  );
}
