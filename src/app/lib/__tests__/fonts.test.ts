import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { bundledWeights, findBundledFont, FONT_CATEGORIES, fontCssUrl, GOOGLE_FONTS, localFontFile, normaliseFamily } from '../fonts';

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
      expect([400, 700, 800, 900]).toContain(f.heavy);
    }
  });

  it('includes Bricolage Grotesque and finds families whatever the case', () => {
    expect(findBundledFont('bricolage grotesque')).toMatchObject({ family: 'Bricolage Grotesque', heavy: 800 });
    expect(findBundledFont('Not Listed')).toBeUndefined();
  });

  it('ships a file for every bundled weight', () => {
    expect(localFontFile('Bebas Neue', 400)).toBe('fonts/bebas-neue-400.woff2');
    expect(bundledWeights({ family: 'Anton', category: 'display', heavy: 400 })).toEqual([400]);
    for (const f of GOOGLE_FONTS) {
      for (const w of bundledWeights(f)) expect(existsSync(`public/${localFontFile(f.family, w)}`), `${f.family} ${w}`).toBe(true);
    }
  });
});
