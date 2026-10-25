import { describe, expect, it } from 'vitest';
import { BRAND_PALETTES, MAX_BRAND_COLORS, mergeColors, normaliseHex, parseHexColors } from '../colors';

describe('normaliseHex', () => {
  it('accepts long and short forms, with or without #', () => {
    expect(normaliseHex('#FF5A1F')).toBe('#ff5a1f');
    expect(normaliseHex('ff5a1f')).toBe('#ff5a1f');
    expect(normaliseHex(' #abc ')).toBe('#aabbcc');
  });
  it('rejects anything else', () => {
    expect(normaliseHex('#ff5a1')).toBeNull();
    expect(normaliseHex('red')).toBeNull();
    expect(normaliseHex('#gggggg')).toBeNull();
  });
});

describe('parseHexColors', () => {
  it('extracts colours whatever the separators', () => {
    expect(parseHexColors('#FF5A1F, #111827\n#2563eb; #fff')).toEqual(['#ff5a1f', '#111827', '#2563eb', '#ffffff']);
    expect(parseHexColors('ff5a1f 111827')).toEqual(['#ff5a1f', '#111827']);
  });
  it('reads a Coolors URL and CSS', () => {
    expect(parseHexColors('https://coolors.co/264653-2a9d8f-e9c46a')).toEqual(['#264653', '#2a9d8f', '#e9c46a']);
    expect(parseHexColors('--brand: #7C3AED; color: #22d3ee;')).toEqual(['#7c3aed', '#22d3ee']);
  });
  it('deduplicates and ignores words', () => {
    expect(parseHexColors('#FFF #ffffff, a decade of #BAD')).toEqual(['#ffffff', '#bbaadd']);
    expect(parseHexColors('add a decade')).toEqual(['#decade']);
  });
});

describe('mergeColors', () => {
  it('skips duplicates and caps the palette', () => {
    expect(mergeColors(['#111111'], ['#111111', '#222222'])).toEqual(['#111111', '#222222']);
    const many = Array.from({ length: 10 }, (_, i) => `#00000${i}`);
    expect(mergeColors([], many)).toHaveLength(MAX_BRAND_COLORS);
  });
});

describe('BRAND_PALETTES', () => {
  it('has ten valid palettes that fit the limit', () => {
    expect(BRAND_PALETTES).toHaveLength(10);
    for (const p of BRAND_PALETTES) {
      expect(p.colors.length).toBeLessThanOrEqual(MAX_BRAND_COLORS);
      for (const c of p.colors) expect(normaliseHex(c)).toBe(c);
    }
  });
});
