import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../../commands';
import { translate } from '../../i18n';

describe('commands', () => {
  it('gives each command its own single lowercase letter', () => {
    const keys = COMMANDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]$/);
  });

  it('binds the letters documented in CLAUDE.md', () => {
    // ⌘↵, ⌘K, Esc and Delete stay in App.tsx: they aren't single letters.
    expect(COMMANDS.map((c) => c.key).sort()).toEqual(['a', 'c', 'g', 'm', 'p', 'r', 't', 'z']);
  });

  it('opens the Gribouillis view with G, even without an image', () => {
    const sketch = COMMANDS.find((c) => c.key === 'g');
    expect(sketch?.id).toBe('sketch');
    expect(sketch?.needsImage).toBe(false);
  });

  it('gives each image tool a short label for the edit bar', () => {
    const short = (lang: 'fr' | 'en') => COMMANDS.filter((c) => c.group === 'tool').map((c) => translate(lang, c.shortLabel!));
    expect(short('fr')).toEqual(['Texte', 'Flèche', 'Zone', 'Recadrer']);
    expect(short('en')).toEqual(['Text', 'Arrow', 'Area', 'Reframe']);
  });
});
