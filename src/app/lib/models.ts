import type { GenerationParams, ImageQuality, ModelId, OutputRatio, Provider, Resolution } from './types';

/**
 * The image models: who serves them, the sizes they reach and what they cost.
 * Nano Banana (Google) is served by every provider; GPT Image 2.5 Sunburst
 * (OpenAI) only by Replicate and OpenRouter.
 */
export const GPT_IMAGE: ModelId = 'gpt-image-2.5-sunburst';
export const IMAGE_QUALITIES: ImageQuality[] = ['low', 'medium', 'high'];
/** A model typed by hand: sent like Nano Banana, its price unknown. */
export const CUSTOM_MODEL: ModelId = 'custom';

export function isCustomModel(model: ModelId): boolean {
  return model === CUSTOM_MODEL;
}

export function isGptImage(model: ModelId): boolean {
  return model === GPT_IMAGE;
}

export function modelAvailable(model: ModelId, provider: Provider): boolean {
  // OpenAI serves its own models only: GPT Image, or one of its ids typed by hand.
  if (provider === 'openai') return isGptImage(model) || isCustomModel(model);
  return !isGptImage(model) || provider === 'replicate' || provider === 'openrouter';
}

/** What a provider falls back to when it doesn't serve the chosen model. */
export function firstAvailableModel(provider: Provider): ModelId {
  return provider === 'openai' ? GPT_IMAGE : 'nano-banana-pro';
}

/** Nano Banana's sizes at 16:9 (Gemini API documentation); 9:16 swaps them. */
const SIZES: Record<Resolution, { width: number; height: number }> = {
  '1K': { width: 1376, height: 768 },
  '2K': { width: 2752, height: 1536 },
  '4K': { width: 5504, height: 3072 },
};

export function outputSize(resolution: Resolution, ratio: OutputRatio): { width: number; height: number } {
  const { width, height } = SIZES[resolution];
  return ratio === '9:16' ? { width: height, height: width } : { width, height };
}

/** The same size asked of GPT Image (« 1376x768 »): its edges are multiples of 16, none above 3840 px. */
export function gptSize(resolution: Resolution, ratio: OutputRatio): string {
  const { width, height } = outputSize(resolution, ratio);
  return `${width}x${height}`;
}

/**
 * What can be chosen: Lite is 1K only; GPT Image stops at 2K (4K is past its 3840 px edge), and
 * on OpenRouter, whose image route takes an aspect ratio only, OpenAI picks the size (none to choose).
 */
export function resolutionsFor(model: ModelId, provider: Provider): Resolution[] {
  if (model === 'nano-banana-2-lite') return ['1K'];
  if (isGptImage(model) || (isCustomModel(model) && provider === 'openai')) return provider === 'openrouter' ? [] : ['1K', '2K'];
  return ['1K', '2K', '4K'];
}

/** The resolution actually asked for, the highest the model reaches up to the chosen one; null when the provider picks it. */
export function resolvedResolution(model: ModelId, provider: Provider, chosen: Resolution): Resolution | null {
  const allowed = resolutionsFor(model, provider);
  if (!allowed.length) return null;
  return allowed.includes(chosen) ? chosen : allowed[allowed.length - 1];
}

/**
 * The area tools, reframing and upscaling stay on Nano Banana: Pro stands in for GPT Image and a model
 * typed by hand. OpenAI has no Nano Banana: there they use the chosen model.
 */
export function editModel(model: ModelId, provider?: Provider): ModelId {
  if (provider === 'openai') return model;
  return isGptImage(model) || isCustomModel(model) ? 'nano-banana-pro' : model;
}

/**
 * Google's standard price per image, in dollars (Gemini API price list, checked in November 2026).
 * Indicative with the other providers. Lite only exists in 1K.
 */
const NANO_BANANA_PRICES: Record<Exclude<ModelId, 'gpt-image-2.5-sunburst' | 'custom'>, Partial<Record<Resolution, number>>> = {
  'nano-banana-pro': { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
  'nano-banana-2': { '1K': 0.067, '2K': 0.101, '4K': 0.151 },
  'nano-banana-2-lite': { '1K': 0.034 },
};

/**
 * GPT Image: OpenAI bills tokens ($30 per million output tokens for 2.5 Sunburst, as for GPT Image 2)
 * and publishes per-image costs for GPT Image 2 only, at 1536×1024. These are scaled by the image's
 * area: an estimate, Sunburst may spend more tokens.
 */
const GPT_PRICES_1536x1024: Record<ImageQuality, number> = { low: 0.005, medium: 0.041, high: 0.165 };
const GPT_REFERENCE_AREA = 1536 * 1024;

function dollars(price: number, lang: 'en' | 'fr'): string {
  return lang === 'fr' ? `${String(price).replace('.', ',')} $` : `$${price}`;
}

/** « 0,067 $ », "$0.067", « ≈ 0,028 $ » for an estimate; `resolution` null: the provider's own size. */
export function imagePrice(model: ModelId, resolution: Resolution | null, lang: 'en' | 'fr', quality: ImageQuality = 'medium'): string {
  if (isCustomModel(model)) return lang === 'fr' ? 'prix inconnu' : 'unknown price';
  if (isGptImage(model)) {
    const { width, height } = resolution ? outputSize(resolution, '16:9') : { width: 1536, height: 1024 };
    const price = Math.round(GPT_PRICES_1536x1024[quality] * ((width * height) / GPT_REFERENCE_AREA) * 1000) / 1000;
    return `≈ ${dollars(price, lang)}`;
  }
  const prices = NANO_BANANA_PRICES[model as keyof typeof NANO_BANANA_PRICES];
  return dollars((resolution && prices[resolution]) ?? prices['1K']!, lang);
}

// ─── What a prompt goes to, named under its eye ─────────────

export const PROVIDER_NAMES: Record<Provider, string> = {
  replicate: 'Replicate',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  mammouth: 'Mammouth',
  vertex: 'Vertex AI',
  openai: 'OpenAI',
};

const IMAGE_MODEL_NAMES: Record<Exclude<ModelId, 'custom'>, string> = {
  'nano-banana-pro': 'Nano Banana Pro',
  'nano-banana-2': 'Nano Banana 2',
  'nano-banana-2-lite': 'Nano Banana 2 Lite',
  'gpt-image-2.5-sunburst': 'GPT Image 2.5 Sunburst',
};

/** The text model of each provider: the concept assistant and the ranking (`providers.ts`). */
const TEXT_MODEL_IDS: Record<Provider, string> = {
  replicate: 'google/gemini-3-flash',
  gemini: 'gemini-3.8-flash',
  vertex: 'gemini-3.8-flash',
  openrouter: 'google/gemini-3.8-flash',
  mammouth: 'gemini-3.8-flash',
  openai: 'gpt-6-luna',
};

export function textModelId(provider: Provider): string {
  return TEXT_MODEL_IDS[provider];
}

/** « Nano Banana 2 · Google Gemini »: the image model and provider a call goes to. */
export function modelNote(params: Pick<GenerationParams, 'model' | 'provider'> & Partial<Pick<GenerationParams, 'customModel' | 'quality'>>): string {
  const name = params.model === 'custom' ? params.customModel || '?' : IMAGE_MODEL_NAMES[params.model];
  return `${name} · ${PROVIDER_NAMES[params.provider]}`;
}

/** « gemini-3.8-flash · Vertex AI »: the text model and provider of the assistant and the ranking. */
export function textModelNote(provider: Provider): string {
  return `${TEXT_MODEL_IDS[provider]} · ${PROVIDER_NAMES[provider]}`;
}

// ─── The tools' own model ──────────────────────────────────

/** The provider and model chosen for the image tools (area, heal, face fix, reframe, upscale, concept previews). */
export interface ToolModelChoice {
  provider: Provider;
  model: ModelId;
}

/** The params of a tool call sent to the provider and model chosen for the tools. */
export function toolParams(base: GenerationParams, choice: ToolModelChoice, customModels: Record<Provider, string>): GenerationParams {
  const { quality, customModel: _customModel, ...rest } = base;
  return {
    ...rest,
    provider: choice.provider,
    model: choice.model,
    resolution: resolvedResolution(choice.model, choice.provider, base.resolution) ?? base.resolution,
    format: choice.provider === 'replicate' ? base.format : 'png',
    ...(isGptImage(choice.model) ? { quality: quality ?? 'medium' } : {}),
    ...(isCustomModel(choice.model) ? { customModel: customModels[choice.provider].trim() } : {}),
  };
}
