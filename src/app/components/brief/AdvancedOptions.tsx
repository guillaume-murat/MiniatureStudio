import { useEffect } from 'react';
import { Field, Section } from '../Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { brandWeightLine, marginLine, priorityLine, qualityLine } from '../../lib/prompt';
import { CUSTOM_MODEL, GPT_IMAGE, IMAGE_QUALITIES, isCustomModel, imagePrice, isGptImage, modelAvailable, outputSize, resolutionsFor, resolvedResolution } from '../../lib/models';
import { ProviderFields } from './ProviderFields';
import { useSettings } from '../../stores/settings';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import { useUI } from '../../stores/ui';
import type { ImageQuality, ModelId, PromptOptions, Provider, Resolution, ResolvedPromptOptions } from '../../lib/types';
import { Input } from '../ui/input';

const LITE: ModelId = 'nano-banana-2-lite';
/** What a model id looks like at each provider (Nano Banana Pro's, as an example). */
const CUSTOM_PLACEHOLDERS: Record<Provider, string> = {
  replicate: 'google/nano-banana-pro',
  gemini: 'gemini-3-pro-image',
  openrouter: 'google/gemini-3-pro-image',
  mammouth: 'gemini-3-pro-image-preview',
  vertex: 'gemini-3-pro-image',
};
const RESOLUTIONS: Resolution[] = ['1K', '2K', '4K'];
const WEIGHTS: ResolvedPromptOptions['brandWeight'][] = ['subtle', 'accents', 'dominant'];

/**
 * Settle what the prompt's blocks could otherwise contradict; starts from the chosen style's preset.
 * Folded by default.
 */
export function AdvancedOptions({ number }: { number: number }) {
  const t = useT();
  const { brief, setBrief, promptOptions } = useWorkspace();
  const keySetup = useUI((s) => s.keySetup);
  const options = promptOptions();
  const { model, lang, provider, quality, aspectRatio, customModels, set: setSettings, ...settings } = useSettings();
  // What the model reaches: Lite 1K only, GPT Image up to 2K, and no choice with OpenRouter's GPT Image.
  const allowed = resolutionsFor(model, provider);
  const resolution = resolvedResolution(model, provider, settings.resolution);
  const gpt = isGptImage(model);
  const models: Array<[ModelId, string, string]> = [
    ['nano-banana-pro', t('brief.modelPro'), t('brief.modelProHint')],
    ['nano-banana-2', t('brief.model2'), t('brief.model2Hint')],
    [LITE, t('brief.modelLite'), t('brief.modelLiteHint')],
    [GPT_IMAGE, t('brief.modelGpt'), t('brief.modelGptHint')],
    [CUSTOM_MODEL, t('brief.modelCustom'), t('brief.modelCustomHint')],
  ];
  const custom = isCustomModel(model);
  const size = (r: Resolution) => {
    const { width, height } = outputSize(r, aspectRatio);
    return `${width}×${height}`;
  };
  const set = (patch: PromptOptions) => setBrief({ options: { ...brief.options, ...patch } });
  // Brought into view for a missing key: the key field gets the focus once the section has unfolded.
  useEffect(() => {
    if (!keySetup) return;
    const timer = setTimeout(() => document.getElementById('apiKey')?.focus({ preventScroll: true }), 400);
    return () => clearTimeout(timer);
  }, [keySetup]);

  return (
    <Section foldable startFolded openSignal={keySetup} title={`${number}. ${t('promptOptions.title')}`}>
      <ProviderFields />

      <Field label={t('brief.model')} htmlFor="model" hint={custom ? undefined : gpt ? t('brief.gptPrices') : t('brief.modelPrices')}>
        <Select value={model} onValueChange={(v) => setSettings({ model: v as ModelId })}>
          <SelectTrigger id="model" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map(([id, name, hint]) => {
              const available = modelAvailable(id, provider);
              return (
                <SelectItem key={id} value={id} disabled={!available}>
                  {name} · {imagePrice(id, resolvedResolution(id, provider, settings.resolution), lang, quality)}{' '}
                  <span className="text-muted-foreground">· {available ? hint : t('brief.modelGptUnavailable')}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Field>

      {custom && (
        <Field label={t('brief.customModel')} htmlFor="customModel" hint={t('brief.customModelHelp')}>
          <Input
            id="customModel"
            autoComplete="off"
            spellCheck={false}
            value={customModels[provider]}
            onChange={(e) => setSettings({ customModels: { ...customModels, [provider]: e.target.value } })}
            placeholder={CUSTOM_PLACEHOLDERS[provider]}
            className="font-mono text-sm"
          />
        </Field>
      )}

      {gpt && (
        <Field label={t('brief.quality')}>
          <ToggleGroup type="single" variant="outline" className="w-full" value={quality} onValueChange={(v) => v && setSettings({ quality: v as ImageQuality })}>
            {IMAGE_QUALITIES.map((q) => (
              <ToggleGroupItem key={q} value={q} className="h-auto min-h-9 flex-1 flex-col gap-0 py-1 text-xs leading-tight">
                {t(`brief.qualities.${q}`)}
                <span className="tabular text-[11px] text-muted-foreground">{imagePrice(model, resolution, lang, q)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      )}

      <Field
        label={t('brief.resolution')}
        hint={model === LITE ? t('brief.liteResolution') : gpt ? t(allowed.length ? 'brief.gptResolution' : 'brief.gptOpenRouterSize') : undefined}
      >
        <ToggleGroup type="single" variant="outline" className="w-full" value={resolution ?? ''} onValueChange={(v) => v && setSettings({ resolution: v as Resolution })}>
          {RESOLUTIONS.map((r) => (
            <ToggleGroupItem key={r} value={r} disabled={!allowed.includes(r)} className="h-auto min-h-9 flex-1 flex-col gap-0 py-1 text-xs leading-tight">
              {r}
              <span className="tabular text-[11px] text-muted-foreground">({size(r)})</span>
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
