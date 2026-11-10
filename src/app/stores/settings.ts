import { firstAvailableModel, IMAGE_QUALITIES, isCustomModel, isGptImage, modelAvailable, resolvedResolution } from '../lib/models';
import { parseClosedPanels, type ClosedPanels } from '../lib/panels';
import { create } from 'zustand';
import { VERTEX_GCLOUD } from '../lib/providers';
import { parseBarOffset, type BarOffset } from '../lib/editBar';
import { outputRatio } from '../lib/prompt';
import type { ImageQuality, Lang, OutputRatio, GenerationParams, ModelId, OutputFormat, Provider, Resolution, SafetyLevel } from '../lib/types';

export type Theme = 'light' | 'dark' | 'system';
export type { Lang };
/** Where API keys live: across sessions (localStorage) or until the tab closes (sessionStorage). */
export type KeyPersistence = 'local' | 'session';

interface SettingsState {
  provider: Provider;
  keys: Record<Provider, string>;
  keyPersistence: KeyPersistence;
  model: ModelId;
  aspectRatio: OutputRatio;
  resolution: Resolution;
  format: OutputFormat;
  safety: SafetyLevel;
  count: 1 | 2 | 4;
  /** GPT Image's quality level. */
  quality: ImageQuality;
  /** The model typed by hand, per provider (each names its models its own way). */
  customModels: Record<Provider, string>;
  theme: Theme;
  lang: Lang;
  /** Where the edit bar was moved to on this device; null at its default place. */
  editBarOffset: BarOffset | null;
  /** The side panels folded by the user on this device (they also fold by themselves where unused). */
  closedPanels: ClosedPanels;

  set: (patch: Partial<Omit<SettingsState, 'set' | 'setKey' | 'params' | 'apiKey'>>) => void;
  setKey: (provider: Provider, key: string) => void;
  params: () => GenerationParams;
  apiKey: () => string;
}

const PROVIDERS: Provider[] = ['replicate', 'gemini', 'openrouter', 'mammouth', 'vertex', 'openai'];
const PREFS_KEY = 'nt_prefs';
const KEY_PREFIX = 'nt_key_';

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(storage: Storage | undefined, key: string, value: string | null): void {
  try {
    if (value === null || value === '') storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) */
  }
}

const hasWindow = typeof window !== 'undefined';
const local = hasWindow ? window.localStorage : undefined;
const session = hasWindow ? window.sessionStorage : undefined;

function detectLang(): Lang {
  if (!hasWindow) return 'en';
  const param = new URLSearchParams(location.search).get('lang');
  const stored = safeGet(local, 'nano_lang');
  const browser = navigator.language.split('-')[0];
  for (const candidate of [param, stored, browser]) {
    if (candidate === 'en' || candidate === 'fr') return candidate;
  }
  return 'en';
}

function load() {
  const prefs = JSON.parse(safeGet(local, PREFS_KEY) || '{}');
  const keyPersistence: KeyPersistence = prefs.keyPersistence === 'session' ? 'session' : 'local';
  const store = keyPersistence === 'session' ? session : local;
  return {
    provider: (PROVIDERS.includes(prefs.provider) ? prefs.provider : 'replicate') as Provider,
    keys: Object.fromEntries(PROVIDERS.map((p) => [p, safeGet(store, KEY_PREFIX + p) ?? ''])) as Record<Provider, string>,
    keyPersistence,
    model: (['nano-banana-2', 'nano-banana-2-lite', 'gpt-image-2.5-sunburst', 'custom'].includes(prefs.model) ? prefs.model : 'nano-banana-pro') as ModelId,
    quality: (IMAGE_QUALITIES.includes(prefs.quality) ? prefs.quality : 'medium') as ImageQuality,
    customModels: Object.fromEntries(PROVIDERS.map((p) => [p, typeof prefs.customModels?.[p] === 'string' ? prefs.customModels[p] : ''])) as Record<Provider, string>,
    aspectRatio: outputRatio(prefs.aspectRatio),
    resolution: (prefs.resolution ?? '1K') as Resolution,
    format: (prefs.format ?? 'png') as OutputFormat,
    safety: (prefs.safety ?? 'block_only_high') as SafetyLevel,
    count: ([1, 2, 4].includes(prefs.count) ? prefs.count : 1) as 1 | 2 | 4,
    theme: (['light', 'dark', 'system'].includes(prefs.theme) ? prefs.theme : 'system') as Theme,
    lang: detectLang(),
    editBarOffset: parseBarOffset(prefs.editBarOffset),
    closedPanels: parseClosedPanels(prefs.closedPanels),
  };
}

function persistPrefs(s: SettingsState): void {
  const { provider, keyPersistence, model, aspectRatio, resolution, format, safety, count, quality, customModels, theme, editBarOffset, closedPanels } = s;
  safeSet(local, PREFS_KEY, JSON.stringify({ provider, keyPersistence, model, aspectRatio, resolution, format, safety, count, quality, customModels, theme, editBarOffset, closedPanels }));
  safeSet(local, 'nano_lang', s.lang);
}

function persistKeys(s: SettingsState): void {
  const [keep, clear] = s.keyPersistence === 'session' ? [session, local] : [local, session];
  for (const provider of PROVIDERS) {
    safeSet(keep, KEY_PREFIX + provider, s.keys[provider]);
    safeSet(clear, KEY_PREFIX + provider, null);
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    // A provider that doesn't serve the chosen model (GPT Image off Replicate and OpenRouter): back to Nano Banana Pro.
    if (!modelAvailable(get().model, get().provider)) set({ model: firstAvailableModel(get().provider) });
    persistPrefs(get());
    if ('keyPersistence' in patch) persistKeys(get());
  },
  setKey: (provider, key) => {
    set({ keys: { ...get().keys, [provider]: key.trim() } });
    persistKeys(get());
  },
  params: () => {
    const { provider, model, aspectRatio, resolution, format, safety, quality, customModels } = get();
    // Lite only exists in 1K, GPT Image stops at 2K (and OpenRouter picks its size: the setting is then unused).
    return {
      provider,
      model,
      aspectRatio,
      resolution: resolvedResolution(model, provider, resolution) ?? resolution,
      format: provider === 'replicate' ? format : 'png',
      safety,
      ...(isGptImage(model) ? { quality } : {}),
      ...(isCustomModel(model) ? { customModel: customModels[provider].trim() } : {}),
    };
  },
  // Vertex works without a key: the local helper authenticates with gcloud.
  apiKey: () => get().keys[get().provider] || (get().provider === 'vertex' ? VERTEX_GCLOUD : ''),
}));
