import type { GenerationParams, ModelId, Provider } from './types';
import { dataUrlToBlob, fetchBlob } from './images';
import { gptSize, isGptImage, textModelId } from './models';

/**
 * Provider layer. Replicate has no browser CORS support, so its calls go through
 * our local function; Gemini, OpenRouter and Mammouth support CORS and are called directly.
 * Vertex AI needs an OAuth token from gcloud, so it goes through the local helper
 * (`local/vertex.ts`, served by `npm run dev` and the macOS app).
 */

const PROXY_URL = '/functions/replicate-proxy?url=';

const REPLICATE_IMAGE_MODELS: Partial<Record<ModelId, string>> = {
  'gpt-image-2.5-sunburst': 'openai/gpt-image-2.5-sunburst',
  'nano-banana-pro': 'google/nano-banana-pro',
  'nano-banana-2': 'google/nano-banana-2',
  'nano-banana-2-lite': 'google/nano-banana-2-lite',
};
const REPLICATE_TEXT_MODEL = textModelId('replicate');

/** Google only serves Nano Banana (no GPT Image). */
type NanoBanana = Exclude<ModelId, 'gpt-image-2.5-sunburst' | 'custom'>;
const GEMINI_IMAGE_MODELS: Record<NanoBanana, string> = {
  'nano-banana-pro': 'gemini-3-pro-image',
  'nano-banana-2': 'gemini-3.1-flash-image',
  'nano-banana-2-lite': 'gemini-3.1-flash-lite-image',
};
const GEMINI_TEXT_MODEL = textModelId('gemini');
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Same-origin route of the local Vertex helper; it adds the gcloud token and the project. */
const VERTEX_BASE = '/vertex/models';
/** Stands in for the key when Vertex should authenticate with gcloud (no express-mode key). */
export const VERTEX_GCLOUD = 'gcloud';

const OPENROUTER_IMAGE_MODELS: Partial<Record<ModelId, string>> = {
  'nano-banana-pro': 'google/gemini-3-pro-image',
  'nano-banana-2': 'google/gemini-3.1-flash-image',
  'nano-banana-2-lite': 'google/gemini-3.1-flash-lite-image',
};
const OPENROUTER_TEXT_MODEL = textModelId('openrouter');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** OpenRouter's image route, the one GPT Image is served on. */
const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';
const OPENROUTER_GPT_IMAGE = 'openai/gpt-image-2.5-sunburst';

// Mammouth speaks the same OpenAI-style dialect as OpenRouter, images included.
const MAMMOUTH_IMAGE_MODELS: Partial<Record<ModelId, string>> = {
  'nano-banana-pro': 'gemini-3-pro-image-preview',
  'nano-banana-2': 'gemini-3.1-flash-image-preview',
  'nano-banana-2-lite': 'gemini-3.1-flash-lite-image',
};
const MAMMOUTH_TEXT_MODEL = textModelId('mammouth');
const MAMMOUTH_URL = 'https://api.mammouth.ai/v1/chat/completions';

/** OpenAI-compatible providers: endpoint and models. */
// OpenAI: images through its Images API (`openaiImage`), text through the same chat completions as OpenRouter.
const OPENAI_BASE = 'https://api.openai.com/v1';
const OPENAI_IMAGE_MODELS: Partial<Record<ModelId, string>> = { 'gpt-image-2.5-sunburst': 'gpt-image-2.5-sunburst' };
/** Fast and cheap, for the concepts and the ranking (OpenAI price list, November 2026). */
const OPENAI_TEXT_MODEL = textModelId('openai');

type ChatProvider = Extract<Provider, 'openrouter' | 'mammouth' | 'openai'>;
const CHAT_PROVIDERS: Record<ChatProvider, { url: string; image: Partial<Record<ModelId, string>>; text: string }> = {
  openrouter: { url: OPENROUTER_URL, image: OPENROUTER_IMAGE_MODELS, text: OPENROUTER_TEXT_MODEL },
  mammouth: { url: MAMMOUTH_URL, image: MAMMOUTH_IMAGE_MODELS, text: MAMMOUTH_TEXT_MODEL },
  openai: { url: `${OPENAI_BASE}/chat/completions`, image: {}, text: OPENAI_TEXT_MODEL },
};

/** Hard ceiling for one generation. Nano Banana Pro at 4K can take a couple of minutes. */
const GENERATION_TIMEOUT_MS = 5 * 60_000;

export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: unknown,
    public provider: Provider,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface ImageRequest {
  prompt: string;
  /** Data URLs, already downscaled. */
  images: string[];
  params: GenerationParams;
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (elapsedMs: number) => void;
}

export interface TextRequest {
  provider: Provider;
  apiKey: string;
  prompt: string;
  system?: string;
  images?: string[];
  json?: boolean;
  signal?: AbortSignal;
}

// ─── Shared helpers ──────────────────────────────────────

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function readError(res: Response, provider: Provider): Promise<ProviderError> {
  const text = await res.text();
  let details: unknown;
  try {
    details = JSON.parse(text);
  } catch {
    details = { raw: text };
  }
  const d = details as { detail?: string; error?: { message?: string } | string; title?: string };
  const message =
    (typeof d.error === 'object' ? d.error?.message : d.error) || d.detail || d.title || `HTTP ${res.status}`;
  return new ProviderError(message, res.status, details, provider);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

// ─── Replicate ───────────────────────────────────────────

interface Prediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?: string | null;
  urls: { get: string; cancel: string };
}

function proxied(url: string): string {
  return `${PROXY_URL}${encodeURIComponent(url)}`;
}

async function replicateRun(
  model: string,
  input: Record<string, unknown>,
  apiKey: string,
  signal: AbortSignal,
  onProgress?: (elapsedMs: number) => void,
): Promise<Prediction> {
  const started = Date.now();
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // `Prefer: wait` makes Replicate hold the request until the prediction ends.
  // Kept short; we poll past that.
  const res = await fetch(proxied(`https://api.replicate.com/v1/models/${model}/predictions`), {
    method: 'POST',
    headers: { ...headers, Prefer: 'wait=8' },
    body: JSON.stringify({ input }),
    signal,
  });
  if (!res.ok) throw await readError(res, 'replicate');

  let prediction: Prediction = await res.json();
  let delay = 1000;

  try {
    while (prediction.status === 'starting' || prediction.status === 'processing') {
      onProgress?.(Date.now() - started);
      await sleep(delay, signal);
      delay = Math.min(delay * 1.4, 3000);
      const poll = await fetch(proxied(prediction.urls.get), { headers, signal, cache: 'no-store' });
      if (poll.ok) prediction = await poll.json();
      else if (poll.status !== 429 && poll.status < 500) throw await readError(poll, 'replicate');
    }
  } catch (error) {
    // Stop paying for a prediction nobody is waiting for anymore.
    if (signal.aborted && prediction.urls?.cancel) {
      fetch(proxied(prediction.urls.cancel), { method: 'POST', headers }).catch(() => {});
    }
    throw error;
  }

  if (prediction.status !== 'succeeded') {
    throw new ProviderError(prediction.error || `Prediction ${prediction.status}`, 500, prediction, 'replicate');
  }
  return prediction;
}

/** Not served by this provider (the settings switch back to Nano Banana Pro; this is the safety net). */
function unavailable(model: ModelId, provider: Provider): ProviderError {
  return new ProviderError(`${model} is not available with ${provider}`, 400, null, provider);
}

async function replicateImage(req: ImageRequest, signal: AbortSignal): Promise<Blob> {
  const { params } = req;
  if (isGptImage(params.model)) return replicateGptImage(req, signal);
  const input: Record<string, unknown> = {
    prompt: req.prompt,
    image_input: req.images,
    aspect_ratio: params.aspectRatio,
    output_format: params.format,
  };
  // Lite is always 1K.
  if (params.model !== 'nano-banana-2-lite') input.resolution = params.resolution;
  // Only Nano Banana Pro exposes a safety level.
  if (params.model === 'nano-banana-pro') input.safety_filter_level = params.safety;

  const prediction = await replicateRun(imageModelId(params, REPLICATE_IMAGE_MODELS), input, req.apiKey, signal, req.onProgress);
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!url) throw new ProviderError('No image in response', 500, prediction, 'replicate');
  return fetchBlob(url, signal);
}

/** GPT Image 2.5 Sunburst on Replicate: the exact size and the quality level. */
async function replicateGptImage(req: ImageRequest, signal: AbortSignal): Promise<Blob> {
  const { params } = req;
  const input: Record<string, unknown> = {
    prompt: req.prompt,
    aspect_ratio: gptSize(params.resolution, params.aspectRatio),
    quality: params.quality ?? 'medium',
    number_of_images: 1,
    output_format: params.format === 'jpg' ? 'jpeg' : 'png',
    moderation: 'low',
  };
  if (req.images.length) input.input_images = req.images;
  const prediction = await replicateRun(imageModelId(params, REPLICATE_IMAGE_MODELS), input, req.apiKey, signal, req.onProgress);
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!url) throw new ProviderError('No image in response', 500, prediction, 'replicate');
  return fetchBlob(url, signal);
}

async function replicateText(req: TextRequest, signal: AbortSignal): Promise<string> {
  const input: Record<string, unknown> = {
    prompt: req.prompt,
    images: req.images ?? [],
    thinking_level: 'low',
    max_output_tokens: 4096,
    temperature: 0.7,
  };
  if (req.system) input.system_instruction = req.system;
  const prediction = await replicateRun(REPLICATE_TEXT_MODEL, input, req.apiKey, signal);
  const out = prediction.output;
  return Array.isArray(out) ? out.join('') : (out ?? '');
}

// ─── Gemini ──────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

function toInlinePart(dataUrl: string): GeminiPart | null {
  const m = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  return m ? { inlineData: { mimeType: m[1], data: m[2] } } : null;
}

/** Gemini API and Vertex AI share the generateContent format; only the endpoint and auth differ. */
type GoogleProvider = Extract<Provider, 'gemini' | 'vertex'>;

async function geminiCall(
  provider: GoogleProvider,
  model: string,
  body: unknown,
  apiKey: string,
  signal: AbortSignal,
): Promise<GeminiResponse> {
  const vertex = provider === 'vertex';
  // Key goes in a header, never in the URL (URLs end up in logs and history).
  const auth: Record<string, string> = vertex && apiKey === VERTEX_GCLOUD ? {} : { 'x-goog-api-key': apiKey };
  const res = await fetch(`${vertex ? VERTEX_BASE : GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    // No helper behind this origin (e.g. the hosted site): a plain 404 page instead of a JSON error.
    if (vertex && res.status === 404 && !res.headers.get('content-type')?.includes('json')) {
      throw new ProviderError('Local Vertex AI helper not found', 503, null, provider);
    }
    throw await readError(res, provider);
  }
  return res.json();
}

async function geminiImage(req: ImageRequest, signal: AbortSignal): Promise<Blob> {
  const started = Date.now();
  const tick = req.onProgress ? setInterval(() => req.onProgress?.(Date.now() - started), 500) : undefined;
  try {
    const parts: GeminiPart[] = [{ text: req.prompt }, ...req.images.map(toInlinePart).filter((p): p is GeminiPart => !!p)];
    const provider = req.params.provider as GoogleProvider;
    const data = await geminiCall(
      provider,
      imageModelId(req.params, GEMINI_IMAGE_MODELS),
      {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: req.params.aspectRatio, imageSize: req.params.resolution },
        },
      },
      req.apiKey,
      signal,
    );
    const candidate = data.candidates?.[0];
    const image = candidate?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!image) {
      const reason = data.promptFeedback?.blockReason || candidate?.finishReason || 'NO_IMAGE';
      throw new ProviderError(`Gemini returned no image (${reason})`, 422, data, provider);
    }
    return dataUrlToBlob(`data:${image.mimeType};base64,${image.data}`);
  } finally {
    clearInterval(tick);
  }
}

async function geminiText(req: TextRequest, signal: AbortSignal): Promise<string> {
  const parts: GeminiPart[] = [
    { text: req.prompt },
    ...(req.images ?? []).map(toInlinePart).filter((p): p is GeminiPart => !!p),
  ];
  const data = await geminiCall(
    req.provider as GoogleProvider,
    GEMINI_TEXT_MODEL,
    {
      contents: [{ role: 'user', parts }],
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      generationConfig: {
        temperature: 0.7,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    },
    req.apiKey,
    signal,
  );
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}

// ─── OpenRouter & Mammouth ───────────────────────────────
// OpenAI-compatible chat completions. Port of the v1 contribution by @przxmus (PR #4).

type OpenRouterContent = Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
interface OpenRouterResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; images?: Array<{ image_url?: { url?: string } }> };
  }>;
  error?: { message?: string; code?: number | string };
}

function openRouterContent(prompt: string, images: string[] = []): OpenRouterContent {
  return [{ type: 'text', text: prompt }, ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } }))];
}

async function openRouterCall(
  provider: ChatProvider,
  body: unknown,
  apiKey: string,
  signal: AbortSignal,
): Promise<OpenRouterResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  if (provider === 'openrouter') {
    // App attribution on openrouter.ai (optional headers).
    headers['HTTP-Referer'] = location.origin;
    headers['X-Title'] = 'Miniature Studio';
  }
  const res = await fetch(CHAT_PROVIDERS[provider].url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok) throw await readError(res, provider);
  const data: OpenRouterResponse = await res.json();
  // Upstream failures can come back as 200 with an error object.
  if (data.error) {
    const status = typeof data.error.code === 'number' ? data.error.code : 500;
    throw new ProviderError(data.error.message || `${provider} error`, status, data, provider);
  }
  return data;
}

function throwUnavailable(model: ModelId, provider: Provider): never {
  throw unavailable(model, provider);
}

/** The provider's id for the chosen model: from its table, or as typed by hand for a custom model. */
function imageModelId(params: GenerationParams, table: Partial<Record<ModelId, string>>): string {
  if (params.model === 'custom') {
    const id = params.customModel?.trim();
    if (!id) throw new ProviderError('No custom model id', 400, null, params.provider);
    return id;
  }
  return table[params.model] ?? throwUnavailable(params.model, params.provider);
}

interface OpenRouterImagesResponse {
  data?: Array<{ b64_json?: string; url?: string; media_type?: string }>;
  error?: { message?: string; code?: number | string };
}

/**
 * GPT Image on OpenRouter goes through its image route, not chat completions. It takes an
 * aspect ratio and a quality, not a size: OpenAI picks the resolution.
 */
async function openRouterGptImage(req: ImageRequest, signal: AbortSignal): Promise<Blob> {
  const started = Date.now();
  const tick = req.onProgress ? setInterval(() => req.onProgress?.(Date.now() - started), 500) : undefined;
  try {
    const res = await fetch(OPENROUTER_IMAGES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.apiKey}`, 'HTTP-Referer': location.origin, 'X-Title': 'Miniature Studio' },
      body: JSON.stringify({
        model: OPENROUTER_GPT_IMAGE,
        prompt: req.prompt,
        aspect_ratio: req.params.aspectRatio,
        quality: req.params.quality ?? 'medium',
        output_format: 'png',
        n: 1,
        ...(req.images.length ? { input_references: req.images.map((url) => ({ type: 'image_url', image_url: { url } })) } : {}),
      }),
      signal,
    });
    if (!res.ok) throw await readError(res, 'openrouter');
    const data: OpenRouterImagesResponse = await res.json();
    if (data.error) throw new ProviderError(data.error.message || 'openrouter error', typeof data.error.code === 'number' ? data.error.code : 500, data, 'openrouter');
    const image = data.data?.[0];
    if (image?.b64_json) return dataUrlToBlob(`data:${image.media_type || 'image/png'};base64,${image.b64_json}`);
    if (image?.url) return image.url.startsWith('data:') ? dataUrlToBlob(image.url) : fetchBlob(image.url, signal);
    throw new ProviderError('openrouter returned no image', 422, data, 'openrouter');
  } finally {
    clearInterval(tick);
  }
}

async function openRouterImage(req: ImageRequest, signal: AbortSignal): Promise<Blob> {
  const provider = req.params.provider as ChatProvider;
  if (isGptImage(req.params.model)) {
    if (provider !== 'openrouter') throw unavailable(req.params.model, provider);
    return openRouterGptImage(req, signal);
  }
  const started = Date.now();
  const tick = req.onProgress ? setInterval(() => req.onProgress?.(Date.now() - started), 500) : undefined;
  try {
    const data = await openRouterCall(
      provider,
      {
        model: imageModelId(req.params, CHAT_PROVIDERS[provider].image),
        messages: [{ role: 'user', content: openRouterContent(req.prompt, req.images) }],
        modalities: ['image', 'text'],
        image_config: { aspect_ratio: req.params.aspectRatio, image_size: req.params.resolution },
      },
      req.apiKey,
      signal,
    );
    const choice = data.choices?.[0];
    const url = choice?.message?.images?.find((i) => i.image_url?.url)?.image_url?.url;
    if (!url) {
      throw new ProviderError(`${provider} returned no image (${choice?.finish_reason || 'NO_IMAGE'})`, 422, data, provider);
    }
    return url.startsWith('data:') ? dataUrlToBlob(url) : fetchBlob(url, signal);
  } finally {
    clearInterval(tick);
  }
}

async function openRouterText(req: TextRequest, signal: AbortSignal): Promise<string> {
  const provider = req.provider as ChatProvider;
  const data = await openRouterCall(
    provider,
    {
      model: CHAT_PROVIDERS[provider].text,
      messages: [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        { role: 'user', content: openRouterContent(req.prompt, req.images) },
      ],
      // OpenAI's recent models only take their default temperature.
      ...(provider === 'openai' ? {} : { temperature: 0.7 }),
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    },
    req.apiKey,
    signal,
  );
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── OpenAI ──────────────────────────────────────────────

interface OpenAIImagesResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  output_format?: string;
}

/**
 * GPT Image on OpenAI's Images API: `generations` from the prompt alone, `edits` when images are
 * attached (references, people, the image being edited), sent as files. Exact size and quality.
 */
async function openaiImage(req: ImageRequest, signal: AbortSignal): Promise<Blob> {
  const { params } = req;
  const model = imageModelId(params, OPENAI_IMAGE_MODELS);
  const fields: Record<string, string> = {
    model,
    prompt: req.prompt,
    size: gptSize(params.resolution, params.aspectRatio),
    n: '1',
    output_format: 'png',
    ...(params.quality ? { quality: params.quality } : {}),
  };
  const headers = { Authorization: `Bearer ${req.apiKey}` };
  const started = Date.now();
  const tick = req.onProgress ? setInterval(() => req.onProgress?.(Date.now() - started), 500) : undefined;
  try {
    let res: Response;
    if (req.images.length) {
      const form = new FormData();
      for (const [name, value] of Object.entries(fields)) form.append(name, value);
      for (const [i, url] of req.images.entries()) {
        const blob = await dataUrlToBlob(url);
        form.append('image[]', blob, `image-${i + 1}.${blob.type.split('/')[1] || 'png'}`);
      }
      res = await fetch(`${OPENAI_BASE}/images/edits`, { method: 'POST', headers, body: form, signal });
    } else {
      res = await fetch(`${OPENAI_BASE}/images/generations`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, n: 1 }),
        signal,
      });
    }
    if (!res.ok) throw await readError(res, 'openai');
    const data: OpenAIImagesResponse = await res.json();
    const image = data.data?.[0];
    if (image?.b64_json) return dataUrlToBlob(`data:image/${data.output_format || 'png'};base64,${image.b64_json}`);
    if (image?.url) return fetchBlob(image.url, signal);
    throw new ProviderError('openai returned no image', 422, data, 'openai');
  } finally {
    clearInterval(tick);
  }
}

// ─── Public API ──────────────────────────────────────────

export async function generateImage(req: ImageRequest): Promise<Blob> {
  const signal = withTimeout(req.signal, GENERATION_TIMEOUT_MS);
  switch (req.params.provider) {
    case 'gemini':
    case 'vertex':
      return geminiImage(req, signal);
    case 'openrouter':
    case 'mammouth':
      return openRouterImage(req, signal);
    case 'openai':
      return openaiImage(req, signal);
    default:
      return replicateImage(req, signal);
  }
}

export async function generateText(req: TextRequest): Promise<string> {
  const signal = withTimeout(req.signal, 90_000);
  switch (req.provider) {
    case 'gemini':
    case 'vertex':
      return geminiText(req, signal);
    case 'openrouter':
    case 'mammouth':
    case 'openai':
      return openRouterText(req, signal);
    default:
      return replicateText(req, signal);
  }
}

/** Ask for JSON and parse it, tolerating ```json fences some models add. */
export async function generateJSON<T>(req: Omit<TextRequest, 'json'>): Promise<T> {
  const raw = await generateText({ ...req, json: true });
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new ProviderError('Model did not return JSON', 500, { raw }, req.provider);
  return JSON.parse(cleaned.slice(start)) as T;
}
