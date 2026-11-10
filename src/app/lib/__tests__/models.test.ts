import { describe, expect, it } from 'vitest';
import { editModel, gptSize, imagePrice, modelAvailable, outputSize, resolutionsFor, resolvedResolution } from '../models';

describe('image models', () => {
  it('serves GPT Image 2.5 Sunburst on Replicate and OpenRouter only', () => {
    expect(['replicate', 'gemini', 'openrouter', 'mammouth', 'vertex'].filter((p) => modelAvailable('gpt-image-2.5-sunburst', p as never))).toEqual(['replicate', 'openrouter']);
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
});
