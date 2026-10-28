import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../../commands';

describe('commands', () => {
  it('gives each command its own single lowercase letter', () => {
    const keys = COMMANDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]$/);
  });

  it('binds the letters documented in CLAUDE.md', () => {
    // ⌘↵, ⌘K, Esc and Delete stay in App.tsx: they aren't single letters.
    expect(COMMANDS.map((c) => c.key).sort()).toEqual(['a', 'c', 'm', 'p', 'r', 't', 'z']);
  });
});
