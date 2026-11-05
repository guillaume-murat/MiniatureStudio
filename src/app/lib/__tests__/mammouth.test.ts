import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImage, generateText, ProviderError } from '../providers';
import type { GenerationParams } from '../types';

const realFetch = globalThis.fetch;
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const params: GenerationParams = {
  provider: 'mammouth',
  model: 'nano-banana-pro',
  aspectRatio: '16:9',
  resolution: '2K',
  format: 'png',
  safety: 'block_only_high',
};

type Init = { headers: Record<string, string>; body: string };
let api: ReturnType<typeof vi.fn<(input: string, init: Init) => Promise<Response>>>;

beforeEach(() => {
  api = vi.fn<(input: string, init: Init) => Promise<Response>>();
  vi.stubGlobal('location', { origin: 'https://miniature-studio.test' });
  vi.stubGlobal('fetch', (input: string, init: Init) => (input.startsWith('data:') ? realFetch(input) : api(input, init)));
});
afterEach(() => vi.unstubAllGlobals());

describe('Mammouth provider', () => {
  it('requests an image through chat completions and decodes it', async () => {
    api.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: null, images: [{ image_url: { url: JPEG } }] } }] }));

    const blob = await generateImage({ prompt: 'a cat', images: [JPEG], params, apiKey: 'sk-test' });

    expect(blob.type).toBe('image/jpeg');
    const [url, init] = api.mock.calls[0];
    expect(url).toBe('https://api.mammouth.ai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(init.headers['HTTP-Referer']).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gemini-3-pro-image-preview');
    expect(body.modalities).toEqual(['image', 'text']);
    expect(body.image_config).toEqual({ aspect_ratio: '16:9', image_size: '2K' });
  });

  it('uses Gemini 3.8 Flash for text', async () => {
    api.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }));
    expect(await generateText({ provider: 'mammouth', apiKey: 'k', prompt: 'x', json: true })).toBe('{"ok":true}');
    expect(JSON.parse(api.mock.calls[0][1].body).model).toBe('gemini-3.8-flash');
  });

  it('reports errors as Mammouth errors', async () => {
    api.mockResolvedValueOnce(Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }));
    const error = await generateImage({ prompt: 'x', images: [], params, apiKey: 'bad' }).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.provider).toBe('mammouth');
    expect(error.status).toBe(401);
  });
});
