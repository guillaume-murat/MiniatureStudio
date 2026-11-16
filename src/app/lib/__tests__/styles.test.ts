import { describe, expect, it } from 'vitest';
import { STYLES, allStyles, conceptStyles, findStyle, insertStyle, lastGrapheme, resolveOptions } from '../styles';
import type { CustomStyle } from '../types';

const mine: CustomStyle = { id: 'st_1', name: 'Signature', emoji: '🔥', prompt: 'Bold colours', createdAt: 1 };

describe('styles', () => {
  it('gives each preset its own emoji', () => {
    const emojis = STYLES.map((s) => s.emoji);
    expect(emojis.every(Boolean)).toBe(true);
    expect(new Set(emojis).size).toBe(STYLES.length);
  });

  it('writes each preset as a list', () => {
    for (const style of STYLES) {
      for (const text of [style.prompt.fr, style.prompt.en]) expect(text.split('\n').every((line) => line.startsWith('- '))).toBe(true);
      // Line for line, so that neither language asks for more than the other.
      expect(style.prompt.en.split('\n')).toHaveLength(style.prompt.fr.split('\n').length);
    }
  });

  it('lists the user’s styles first, in the presets’ shape', () => {
    const [first, ...rest] = allStyles([mine]);
    expect(first).toMatchObject({ id: 'st_1', custom: true, emoji: '🔥', name: { fr: 'Signature' }, hint: { en: '' } });
    expect(rest).toEqual(STYLES);
  });

  it('lets a style of the user’s write in the image', () => {
    expect(allStyles([mine])[0].preset).toBeUndefined();
    expect(allStyles([{ ...mine, addsText: true }])[0].preset).toEqual({ text: 'style' });
  });

  it('gives the concepts prompt the whole library, in its language', () => {
    const list = conceptStyles('fr', [{ ...mine, hint: 'Vlogs' }]);
    expect(list).toHaveLength(STYLES.length + 1);
    expect(list[0]).toEqual({ id: 'st_1', name: 'Signature', hint: 'Vlogs', prompt: 'Bold colours' });
    expect(list.find((s) => s.id === 'reaction')?.name).toBe('Réaction + objet');
    const reaction = conceptStyles('en', []).find((s) => s.id === 'reaction');
    expect(reaction?.name).toBe('Reaction + object');
    expect(reaction?.prompt).toContain('featured person');
    expect(conceptStyles('en', [mine])[0].prompt).toBe('Bold colours');
  });

  it('finds presets and the user’s styles, but no deleted one', () => {
    expect(findStyle('versus')?.id).toBe('versus');
    expect(findStyle('st_1', [mine])?.prompt.fr).toBe('Bold colours');
    expect(findStyle('st_1')).toBeUndefined();
    expect(findStyle('')).toBeUndefined();
  });

  it('keeps only the last character typed, whole', () => {
    expect(lastGrapheme('🔥🎙️')).toBe('🎙️');
    expect(lastGrapheme('👨‍👩‍👧')).toBe('👨‍👩‍👧');
    expect(lastGrapheme('')).toBe('');
  });

  it('starts the options from the defaults, under the user’s choices', () => {
    expect(resolveOptions(undefined).text).toBe('none');
    expect(resolveOptions({ text: 'style' }).text).toBe('style');
  });
});

describe('inserting a style into the scene', () => {
  const versus = '- Composition divisée en deux\n- Grand badge « VS »';
  const reaction = '- Gros plan serré\n- Fond saturé';

  it('fills an empty scene with the style’s text alone', () => {
    expect(insertStyle('', versus)).toBe(versus);
    expect(insertStyle('  \n', versus)).toBe(versus);
  });

  it('adds it after what the creator wrote, after a blank line', () => {
    expect(insertStyle('Un chef face à un robot cuisinier\n', versus)).toBe(`Un chef face à un robot cuisinier\n\n${versus}`);
  });

  it('replaces the style inserted just before while it is untouched', () => {
    const scene = insertStyle('Un chef', versus);
    expect(insertStyle(scene, reaction, versus)).toBe(`Un chef\n\n${reaction}`);
  });

  it('never replaces a style text the creator has changed', () => {
    const edited = insertStyle('Un chef', versus).replace('deux', 'trois');
    expect(insertStyle(edited, reaction, versus)).toBe(`${edited}\n\n${reaction}`);
  });
});
