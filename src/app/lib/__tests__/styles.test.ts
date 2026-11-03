import { describe, expect, it } from 'vitest';
import { STYLES, allStyles, findStyle, lastGrapheme, optionsForNewStyle, resolveOptions } from '../styles';
import type { CustomStyle } from '../types';

const mine: CustomStyle = { id: 'st_1', name: 'Signature', emoji: '🔥', prompt: 'Bold colours', createdAt: 1 };

describe('styles', () => {
  it('gives each preset its own emoji', () => {
    const emojis = STYLES.map((s) => s.emoji);
    expect(emojis.every(Boolean)).toBe(true);
    expect(new Set(emojis).size).toBe(STYLES.length);
  });

  it('lists the user’s styles first, in the presets’ shape', () => {
    const [first, ...rest] = allStyles([mine]);
    expect(first).toMatchObject({ id: 'st_1', custom: true, emoji: '🔥', name: { fr: 'Signature' }, hint: { en: '' } });
    expect(rest).toEqual(STYLES);
  });

  it('finds presets and the user’s styles, but no deleted one', () => {
    expect(findStyle('versus')?.id).toBe('versus');
    expect(findStyle('st_1', [mine])?.prompt).toBe('Bold colours');
    expect(findStyle('st_1')).toBeUndefined();
    expect(findStyle('')).toBeUndefined();
  });

  it('keeps only the last character typed, whole', () => {
    expect(lastGrapheme('🔥🎙️')).toBe('🎙️');
    expect(lastGrapheme('👨‍👩‍👧')).toBe('👨‍👩‍👧');
    expect(lastGrapheme('')).toBe('');
  });

  it('starts the options from the style’s preset, under the user’s choices', () => {
    expect(resolveOptions(undefined).guidelines.focal).toBe(true);
    const versus = resolveOptions(findStyle('versus'));
    expect(versus.text).toBe('style');
    expect(versus.guidelines.focal).toBe(false);
    expect(resolveOptions(findStyle('clay')).likeness).toBe('style');
    const mineToo = resolveOptions(findStyle('versus'), { text: 'none', guidelines: { focal: true } });
    expect([mineToo.text, mineToo.guidelines.focal]).toEqual(['none', true]);
  });

  it('forgets what depends on the style when it changes', () => {
    expect(optionsForNewStyle({ text: 'style', likeness: 'style', guidelines: { focal: false }, titleZone: 'left', brandWeight: 'subtle' })).toEqual({ titleZone: 'left', brandWeight: 'subtle' });
    expect(optionsForNewStyle(undefined)).toBeUndefined();
  });
});
