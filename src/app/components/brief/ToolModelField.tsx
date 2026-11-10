import { Field } from '../Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useSettings } from '../../stores/settings';
import { firstAvailableModel, imagePrice, modelAvailable, modelNote, PROVIDER_NAMES, resolvedResolution } from '../../lib/models';
import { useT } from '../../i18n';
import type { ModelId, Provider } from '../../lib/types';

const PROVIDERS: Provider[] = ['gemini', 'vertex', 'replicate', 'openrouter', 'mammouth', 'openai'];
const MODELS: ModelId[] = ['nano-banana-pro', 'nano-banana-2', 'nano-banana-2-lite', 'gpt-image-2.5-sunburst', 'custom'];
const AUTO = 'auto';

/**
 * The provider and model of the image tools (area, heal, face fix, reframe, upscale, concept
 * previews), apart from the generation's: e.g. generating with OpenAI, retouching with Nano
 * Banana Pro through Google Gemini. Automatic keeps the built-in rule.
 */
export function ToolModelField() {
  const t = useT();
  const { toolModel, keys, lang, resolution, quality, customModels, set } = useSettings();
  const missingKey = toolModel && toolModel.provider !== 'vertex' && !keys[toolModel.provider];
  return (
    <Field
      label={t('toolModel.title')}
      htmlFor="toolProvider"
      hint={
        missingKey ? (
          <span className="text-destructive">{t('toolModel.noKey', { provider: PROVIDER_NAMES[toolModel.provider] })}</span>
        ) : toolModel ? (
          t('toolModel.hint')
        ) : (
          `${t('toolModel.hint')} ${t('toolModel.autoHint')}`
        )
      }
    >
      <div className="flex gap-2">
        <Select
          value={toolModel?.provider ?? AUTO}
          onValueChange={(v) => {
            if (v === AUTO) return set({ toolModel: null });
            const provider = v as Provider;
            // Keeps the model when the new provider serves it.
            const model = toolModel && modelAvailable(toolModel.model, provider) ? toolModel.model : firstAvailableModel(provider);
            set({ toolModel: { provider, model } });
          }}
        >
          <SelectTrigger id="toolProvider" className="min-w-0 flex-1" aria-label={t('toolModel.provider')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{t('toolModel.auto')}</SelectItem>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                {PROVIDER_NAMES[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {toolModel && (
          <Select value={toolModel.model} onValueChange={(v) => set({ toolModel: { ...toolModel, model: v as ModelId } })}>
            <SelectTrigger className="min-w-0 flex-1" aria-label={t('toolModel.model')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.filter((m) => modelAvailable(m, toolModel.provider)).map((m) => (
                <SelectItem key={m} value={m}>
                  {modelNote({ model: m, provider: toolModel.provider, customModel: m === 'custom' ? customModels[toolModel.provider] || t('brief.modelCustom') : undefined }).split(' · ')[0]}
                  <span className="text-muted-foreground"> · {imagePrice(m, resolvedResolution(m, toolModel.provider, resolution), lang, quality)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </Field>
  );
}
