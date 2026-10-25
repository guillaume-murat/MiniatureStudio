import { describe, expect, it } from 'vitest';
import { FONT_CATEGORIES, fontCssUrl, GOOGLE_FONTS, normaliseFamily } from '../fonts';

describe('normaliseFamily', () => {
  it('tidies spacing and keeps valid names', () => {
    expect(normaliseFamily('  Bebas   Neue ')).toBe('Bebas Neue');
    expect(normaliseFamily('Exo 2')).toBe('Exo 2');
  });
  it('rejects names that could not be a Google Fonts family', () => {
    expect(normaliseFamily('')).toBeNull();
    expect(normaliseFamily('Anton&family=Evil')).toBeNull();
    expect(normaliseFamily('"Roboto"')).toBeNull();
  });
});

describe('fontCssUrl', () => {
  it('builds the CSS API URL with an optional weight', () => {
    expect(fontCssUrl('Bebas Neue')).toBe('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
    expect(fontCssUrl('Montserrat', 900)).toBe('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
  });
});

describe('GOOGLE_FONTS', () => {
  it('lists unique, valid families in known categories', () => {
    const families = GOOGLE_FONTS.map((f) => f.family);
    expect(new Set(families).size).toBe(families.length);
    for (const f of GOOGLE_FONTS) {
      expect(normaliseFamily(f.family)).toBe(f.family);
      expect(FONT_CATEGORIES).toContain(f.category);
    }
  });
});
