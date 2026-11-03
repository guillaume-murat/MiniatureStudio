import { describe, expect, it } from 'vitest';
import { STYLES, allStyles, conceptStyles, findStyle, lastGrapheme, optionsForNewStyle, resolveOptions } from '../styles';
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

  it('lets a style of the user’s allow text in the image', () => {
    expect(resolveOptions(findStyle('st_1', [mine])).text).toBe('none');
    expect(resolveOptions(findStyle('st_1', [{ ...mine, addsText: true }])).text).toBe('style');
  });

  it('gives the concepts prompt the whole library, in French', () => {
    const list = conceptStyles([{ ...mine, hint: 'Vlogs' }]);
    expect(list).toHaveLength(STYLES.length + 1);
    expect(list[0]).toEqual({ id: 'st_1', name: 'Signature', hint: 'Vlogs', prompt: 'Bold colours' });
    expect(list.find((s) => s.id === 'reaction')?.name).toBe('Réaction + objet');
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
    expect(resolveOptions(undefined).text).toBe('none');
    expect(resolveOptions(findStyle('versus')).text).toBe('style');
    expect(resolveOptions(findStyle('reaction'), { text: 'style' }).text).toBe('style');
  });

  it('keeps text on for a style that adds some', () => {
    expect(resolveOptions(findStyle('versus'), { text: 'none' }).text).toBe('style');
  });

  it('forgets what depends on the style when it changes', () => {
    expect(optionsForNewStyle({ text: 'style', titleZone: 'left', brandWeight: 'subtle' })).toEqual({ titleZone: 'left', brandWeight: 'subtle' });
    expect(optionsForNewStyle(undefined)).toBeUndefined();
  });
});
