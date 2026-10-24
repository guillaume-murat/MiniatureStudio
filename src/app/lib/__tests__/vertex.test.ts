import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImage, generateText, ProviderError, VERTEX_GCLOUD } from '../providers';
import { explainError } from '../errors';
import type { GenerationParams } from '../types';

const realFetch = globalThis.fetch;
const PNG_B64 = 'iVBORw0KGgo=';
const params: GenerationParams = {
  provider: 'vertex',
  model: 'nano-banana-2',
  aspectRatio: '16:9',
  resolution: '2K',
  format: 'png',
  safety: 'block_only_high',
};

type Init = { headers: Record<string, string>; body: string };
let api: ReturnType<typeof vi.fn<(input: string, init: Init) => Promise<Response>>>;

beforeEach(() => {
  api = vi.fn<(input: string, init: Init) => Promise<Response>>();
  vi.stubGlobal('fetch', (input: string, init: Init) => (input.startsWith('data:') ? realFetch(input) : api(input, init)));
});
afterEach(() => vi.unstubAllGlobals());

describe('Vertex AI provider', () => {
  it('calls the local helper without a key when gcloud handles auth', async () => {
    api.mockResolvedValueOnce(
      Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_B64 } }] } }] }),
    );
    const blob = await generateImage({ prompt: 'a cat', images: [], params, apiKey: VERTEX_GCLOUD });

    expect(blob.type).toBe('image/png');
    const [url, init] = api.mock.calls[0];
    expect(url).toBe('/vertex/models/gemini-3.1-flash-image:generateContent');
    expect(init.headers['x-goog-api-key']).toBeUndefined();
    expect(JSON.parse(init.body).generationConfig.imageConfig).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
  });

  it('forwards an express-mode key to the helper', async () => {
    api.mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }));
    expect(await generateText({ provider: 'vertex', apiKey: 'AQ.key', prompt: 'x' })).toBe('hi');
    expect(api.mock.calls[0][1].headers['x-goog-api-key']).toBe('AQ.key');
    expect(api.mock.calls[0][0]).toBe('/vertex/models/gemini-3.8-flash:generateContent');
  });

  it('explains that the helper is missing on a hosted site', async () => {
    api.mockResolvedValueOnce(new Response('<html>Not found</html>', { status: 404, headers: { 'content-type': 'text/html' } }));
    const error = await generateText({ provider: 'vertex', apiKey: VERTEX_GCLOUD, prompt: 'x' }).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(explainError(error).key).toBe('errors.vertexLocal');
  });
});
