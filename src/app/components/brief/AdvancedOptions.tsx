import { Field, Section } from '../Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { brandWeightLine, marginLine, priorityLine, qualityLine } from '../../lib/prompt';
import { imagePrice } from '../../lib/pricing';
import { useSettings } from '../../stores/settings';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { ModelId, PromptOptions, Resolution, ResolvedPromptOptions } from '../../lib/types';

const LITE: ModelId = 'nano-banana-2-lite';
const RESOLUTIONS: Resolution[] = ['1K', '2K', '4K'];
const WEIGHTS: ResolvedPromptOptions['brandWeight'][] = ['subtle', 'accents', 'dominant'];

/**
 * Settle what the prompt's blocks could otherwise contradict; starts from the chosen style's preset.
 * Folded by default.
 */
export function AdvancedOptions({ number }: { number: number }) {
  const t = useT();
  const { brief, setBrief, promptOptions } = useWorkspace();
  const options = promptOptions();
  const { model, lang, set: setSettings, ...settings } = useSettings();
  // Lite only exists in 1K.
  const resolution = model === LITE ? '1K' : settings.resolution;
  const models: Array<[ModelId, string, string]> = [
    ['nano-banana-pro', t('brief.modelPro'), t('brief.modelProHint')],
    ['nano-banana-2', t('brief.model2'), t('brief.model2Hint')],
    [LITE, t('brief.modelLite'), t('brief.modelLiteHint')],
  ];
  const set = (patch: PromptOptions) => setBrief({ options: { ...brief.options, ...patch } });

  return (
    <Section foldable startFolded title={`${number}. ${t('promptOptions.title')}`}>
      <Field label={t('brief.model')} htmlFor="model" hint={t('brief.modelPrices')}>
        <Select value={model} onValueChange={(v) => setSettings({ model: v as ModelId })}>
          <SelectTrigger id="model" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map(([id, name, hint]) => (
              <SelectItem key={id} value={id}>
                {name} · {imagePrice(id, resolution, lang)} <span className="text-muted-foreground">· {hint}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t('brief.resolution')} hint={model === LITE ? t('brief.liteResolution') : undefined}>
        <ToggleGroup type="single" variant="outline" className="w-full" value={resolution} onValueChange={(v) => v && setSettings({ resolution: v as Resolution })}>
          {RESOLUTIONS.map((r) => (
            <ToggleGroupItem key={r} value={r} disabled={model === LITE && r !== '1K'} className="flex-1">
              {r}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field label={t('promptOptions.brandWeight')} hint={t('promptOptions.brandHint')} prompt={brandWeightLine(lang, options.brandWeight)}>
        <ToggleGroup type="single" variant="outline" className="w-full" value={options.brandWeight} onValueChange={(v) => v && set({ brandWeight: v as PromptOptions['brandWeight'] })}>
          {WEIGHTS.map((w) => (
            <ToggleGroupItem key={w} value={w} className="flex-1 px-1 text-xs">
              {t(`promptOptions.weights.${w}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field label={t('brief.promptAlways')} prompt={`${qualityLine(lang)}\n\n${marginLine(lang)}\n\n${priorityLine(lang)}`} />
    </Section>
  );
}
