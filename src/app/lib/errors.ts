import { isBlobStoreError } from './blobStore';
import { isAbort, ProviderError } from './providers';
import type { TKey } from '../i18n';
import type { GenerationAction, GenerationKind, GenerationParams } from './types';

/** Maps any thrown value to a translated, user-facing explanation. */
export function explainError(error: unknown): { key: TKey; message: string; details?: unknown; status?: number } {
  if (error instanceof DOMException && error.name === 'TimeoutError') return { key: 'errors.timeout', message: error.message };
  if (isAbort(error)) return { key: 'canvas.canceled', message: 'aborted' };
  if (error instanceof ProviderError) {
    const msg = error.message.toLowerCase();
    const base = { message: error.message, details: error.details, status: error.status };
    if (error.provider === 'vertex' && error.status === 503) return { key: 'errors.vertexLocal', ...base };
    if (error.status === 401 || (error.status === 403 && !msg.includes('origin'))) return { key: 'errors.auth', ...base };
    if (error.status === 402 || msg.includes('credit') || msg.includes('billing')) return { key: 'errors.credit', ...base };
    if (error.status === 429 || msg.includes('quota') || msg.includes('rate')) return { key: 'errors.rate', ...base };
    if (error.status === 413) return { key: 'errors.tooLarge', ...base };
    if (msg.includes('safety') || msg.includes('sensitive') || msg.includes('blocked') || msg.includes('prohibited') || msg.includes('nsfw'))
      return { key: 'errors.safety', ...base };
    return { key: 'errors.generic', ...base };
  }
  if (isBlobStoreError(error)) return { key: 'errors.storage', message: (error as DOMException).message };
  if (error instanceof TypeError) return { key: 'errors.network', message: error.message };
  // Not from the provider: something failed in the studio (reading an image, saving it…).
  return { key: 'errors.local', message: error instanceof Error || error instanceof DOMException ? error.message : String(error) };
}

/** Where an image job was when it failed. */
export type JobStep = 'prepare' | 'call' | 'finalize' | 'save';

const STEPS: Record<JobStep, string> = {
  prepare: 'preparing the images to send',
  call: 'waiting for the model',
  finalize: 'processing the result',
  save: 'saving the new version',
};

export interface JobContext {
  at: number;
  step: JobStep;
  kind: GenerationKind;
  action?: GenerationAction;
  params: GenerationParams;
  /** The images as the job got them, before downscaling. */
  images: Blob[];
  promptLength: number;
  elapsedMs: number;
  userAgent: string;
  /** Never written in the log (the API key). */
  secret?: string;
}

const LONG = 300;

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** The provider's response, readable: long values (base64 images) cut short. */
function shorten(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'string' && v.length > LONG ? `${v.slice(0, LONG)}… (${v.length} characters)` : v), 2);
  } catch {
    return String(value);
  }
}

/** Everything known about a failed image job, as text to read or copy. */
export function errorLog(error: unknown, ctx: JobContext): string {
  const e = error instanceof Error || error instanceof DOMException ? error : null;
  const lines = [
    `Time: ${new Date(ctx.at).toISOString()}`,
    `Step: ${ctx.step} (${STEPS[ctx.step]})`,
    `Job: ${ctx.kind}${ctx.action ? ` / ${ctx.action}` : ''}, after ${(ctx.elapsedMs / 1000).toFixed(1)} s`,
    `Provider: ${ctx.params.provider}, model ${ctx.params.model}, ${ctx.params.resolution}, ${ctx.params.aspectRatio}, ${ctx.params.format}`,
    `Prompt: ${ctx.promptLength} characters`,
    `Images sent: ${ctx.images.length === 1 ? "1 image" : `${ctx.images.length} images`}`,
    ...ctx.images.map((b, i) => `  ${i + 1}. ${b.type || 'unknown type'}, ${size(b.size)}`),
    '',
    `Error: ${e ? e.name : typeof error}${error instanceof ProviderError ? ` from ${error.provider}, HTTP ${error.status}` : ''}`,
    `Message: ${e ? e.message : String(error)}`,
  ];
  if (error instanceof ProviderError && error.details !== undefined) lines.push('', 'Response:', shorten(error.details));
  const cause = e && 'cause' in e ? (e as Error).cause : undefined;
  if (cause !== undefined) lines.push('', `Cause: ${cause instanceof Error ? `${cause.name}: ${cause.message}` : shorten(cause)}`);
  if (e?.stack) lines.push('', 'Stack:', e.stack);
  lines.push('', `Browser: ${ctx.userAgent}`);
  const text = lines.join('\n');
  return ctx.secret ? text.split(ctx.secret).join('[API key]') : text;
}
