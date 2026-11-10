import { describe, expect, it } from 'vitest';
import { CUSTOM_MODEL, editModel, toolParams, modelNote, textModelId, textModelNote, firstAvailableModel, gptSize, isCustomModel, imagePrice, modelAvailable, outputSize, resolutionsFor, resolvedResolution } from '../models';

describe('image models', () => {
  it('serves GPT Image 2.5 Sunburst on Replicate, OpenRouter and OpenAI only', () => {
    expect(['replicate', 'gemini', 'openrouter', 'mammouth', 'vertex', 'openai'].filter((p) => modelAvailable('gpt-image-2.5-sunburst', p as never))).toEqual(['replicate', 'openrouter', 'openai']);
    expect(modelAvailable('nano-banana-pro', 'vertex')).toBe(true);
  });

  it('gives the sizes Nano Banana produces, in both formats', () => {
    expect(outputSize('1K', '16:9')).toEqual({ width: 1376, height: 768 });
    expect(outputSize('2K', '16:9')).toEqual({ width: 2752, height: 1536 });
    expect(outputSize('4K', '16:9')).toEqual({ width: 5504, height: 3072 });
    expect(outputSize('1K', '9:16')).toEqual({ width: 768, height: 1376 });
  });

  it('asks GPT Image for the same sizes, within its limits (edges multiple of 16, at most 3840 px)', () => {
    for (const r of ['1K', '2K'] as const)
      for (const ratio of ['16:9', '9:16'] as const) {
        const { width, height } = outputSize(r, ratio);
        expect(width % 16).toBe(0);
        expect(height % 16).toBe(0);
        expect(Math.max(width, height)).toBeLessThanOrEqual(3840);
        expect(gptSize(r, ratio)).toBe(`${width}x${height}`);
      }
    expect(Math.max(outputSize('4K', '16:9').width)).toBeGreaterThan(3840);
  });

  it('offers the resolutions each model reaches', () => {
    expect(resolutionsFor('nano-banana-pro', 'gemini')).toEqual(['1K', '2K', '4K']);
    expect(resolutionsFor('nano-banana-2-lite', 'gemini')).toEqual(['1K']);
    expect(resolutionsFor('gpt-image-2.5-sunburst', 'replicate')).toEqual(['1K', '2K']);
    // OpenRouter's image route takes an aspect ratio, not a size.
    expect(resolutionsFor('gpt-image-2.5-sunburst', 'openrouter')).toEqual([]);
    expect(resolvedResolution('gpt-image-2.5-sunburst', 'replicate', '4K')).toBe('2K');
    expect(resolvedResolution('nano-banana-2-lite', 'gemini', '2K')).toBe('1K');
    expect(resolvedResolution('gpt-image-2.5-sunburst', 'openrouter', '2K')).toBeNull();
  });

  it('keeps the area tools, reframing and upscaling on Nano Banana', () => {
    expect(editModel('gpt-image-2.5-sunburst')).toBe('nano-banana-pro');
    expect(editModel('nano-banana-2')).toBe('nano-banana-2');
  });

  it('estimates the GPT Image price from its quality and size', () => {
    expect(imagePrice('gpt-image-2.5-sunburst', '1K', 'en', 'medium')).toBe('≈ $0.028');
    expect(imagePrice('gpt-image-2.5-sunburst', '2K', 'fr', 'high')).toBe('≈ 0,443 $');
    expect(imagePrice('nano-banana-2', '2K', 'en')).toBe('$0.101');
    // Size left to OpenRouter: OpenAI's own landscape size, 1536×1024.
    expect(imagePrice('gpt-image-2.5-sunburst', null, 'en', 'low')).toBe('≈ $0.005');
  });

  it('takes a model typed by hand, sent as Nano Banana would be, on every provider', () => {
    expect(isCustomModel(CUSTOM_MODEL)).toBe(true);
    expect(['replicate', 'gemini', 'openrouter', 'mammouth', 'vertex'].every((p) => modelAvailable(CUSTOM_MODEL, p as never))).toBe(true);
    expect(resolutionsFor(CUSTOM_MODEL, 'openrouter')).toEqual(['1K', '2K', '4K']);
    // Its price is unknown; the area tools stay on Nano Banana Pro.
    expect(imagePrice(CUSTOM_MODEL, '1K', 'fr')).toBe('prix inconnu');
    expect(imagePrice(CUSTOM_MODEL, '1K', 'en')).toBe('unknown price');
    expect(editModel(CUSTOM_MODEL)).toBe('nano-banana-pro');
  });

  it('offers only GPT Image and a model typed by hand with OpenAI', () => {
    expect(['nano-banana-pro', 'nano-banana-2', 'nano-banana-2-lite', 'gpt-image-2.5-sunburst', 'custom'].filter((m) => modelAvailable(m as never, 'openai'))).toEqual(['gpt-image-2.5-sunburst', 'custom']);
    expect(firstAvailableModel('openai')).toBe('gpt-image-2.5-sunburst');
    expect(firstAvailableModel('gemini')).toBe('nano-banana-pro');
    expect(resolutionsFor('gpt-image-2.5-sunburst', 'openai')).toEqual(['1K', '2K']);
    expect(resolutionsFor('custom', 'openai')).toEqual(['1K', '2K']);
  });

  it('keeps the area tools on the chosen model with OpenAI, which has no Nano Banana', () => {
    expect(editModel('gpt-image-2.5-sunburst', 'openai')).toBe('gpt-image-2.5-sunburst');
    expect(editModel('gpt-image-2.5-sunburst', 'replicate')).toBe('nano-banana-pro');
  });

  it('names the model and provider a prompt goes to', () => {
    expect(modelNote({ model: 'nano-banana-2', provider: 'gemini' })).toBe('Nano Banana 2 · Google Gemini');
    expect(modelNote({ model: 'gpt-image-2.5-sunburst', provider: 'openai', quality: 'low' })).toBe('GPT Image 2.5 Sunburst · OpenAI');
    expect(modelNote({ model: 'custom', provider: 'openrouter', customModel: 'black-forest-labs/flux-2-pro' })).toBe('black-forest-labs/flux-2-pro · OpenRouter');
    expect(textModelNote('vertex')).toBe('gemini-3.8-flash · Vertex AI');
    expect(textModelNote('openai')).toBe('gpt-6-luna · OpenAI');
    expect(textModelId('replicate')).toBe('google/gemini-3-flash');
  });

  it('sends the tools to the provider and model chosen for them', () => {
    const base = { provider: 'openai', model: 'gpt-image-2.5-sunburst', aspectRatio: '9:16', resolution: '2K', format: 'jpg', safety: 'block_only_high', quality: 'high' } as const;
    const customModels = { replicate: '', gemini: '', openrouter: 'black-forest-labs/flux-2-pro', mammouth: '', vertex: '', openai: '' };
    expect(toolParams(base, { provider: 'gemini', model: 'nano-banana-pro' }, customModels)).toEqual({ provider: 'gemini', model: 'nano-banana-pro', aspectRatio: '9:16', resolution: '2K', format: 'png', safety: 'block_only_high' });
    // GPT Image keeps the quality and stops at 2K; Lite is 1K only.
    expect(toolParams({ ...base, resolution: '4K' }, { provider: 'replicate', model: 'gpt-image-2.5-sunburst' }, customModels)).toMatchObject({ resolution: '2K', quality: 'high', format: 'jpg' });
    expect(toolParams(base, { provider: 'gemini', model: 'nano-banana-2-lite' }, customModels).resolution).toBe('1K');
    expect(toolParams(base, { provider: 'openrouter', model: 'custom' }, customModels).customModel).toBe('black-forest-labs/flux-2-pro');
  });
});
