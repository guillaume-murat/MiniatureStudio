import { describe, expect, it } from 'vitest';
import { imagePrice } from '../pricing';

describe('imagePrice', () => {
  it('follows the model and the resolution, in the language’s format', () => {
    expect(imagePrice('nano-banana-2', '2K', 'fr')).toBe('0,101 $');
    expect(imagePrice('nano-banana-pro', '4K', 'en')).toBe('$0.24');
  });

  it('keeps the 1K price for Lite, its only resolution', () => {
    expect(imagePrice('nano-banana-2-lite', '4K', 'fr')).toBe('0,034 $');
  });
});
