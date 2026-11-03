import { describe, expect, it } from 'vitest';
import { conceptIdea, conceptPoints, conceptsPrompt } from '../ai';

const input = { videoTitle: 'Mars', lang: 'fr', styles: [{ id: 'versus', name: 'Versus', hint: 'Comparatifs', prompt: 'Composition divisée en deux.' }] } as const;

describe('conceptsPrompt', () => {
  it('holds what the assistant sends', () => {
    const p = conceptsPrompt({ ...input, styles: [...input.styles] });
    for (const part of ['grand stratège', 'Titre de la vidéo : "Mars"', '- versus : Versus (Comparatifs). Composition divisée en deux.', 'rédigée en français']) expect(p).toContain(part);
  });

  it('nests a style written as a list', () => {
    const styles = [{ id: 'x', name: 'X', hint: '', prompt: '- Un\n- Deux' }];
    expect(conceptsPrompt({ ...input, styles })).toContain('- x : X.\n  - Un\n  - Deux');
  });

  it('starts from the title alone', () => {
    expect(conceptsPrompt({ ...input, styles: [] })).not.toContain('Idée de départ');
  });
});

describe('conceptPoints', () => {
  it('fills the brief with one point per line', () => {
    expect(conceptIdea({ brief: 'Une scène.', points: ['Gros plan', 'Fond sombre'] })).toBe('- Gros plan\n- Fond sombre');
  });

  it('lists the points the model gave', () => {
    expect(conceptPoints({ brief: 'Une scène.', points: [' Gros plan ', '', 'Fond sombre'] })).toEqual(['Gros plan', 'Fond sombre']);
  });

  it('falls back on the sentences of the brief', () => {
    expect(conceptPoints({ brief: 'Un visage choqué. Un robot ! Fond sombre' })).toEqual(['Un visage choqué.', 'Un robot !', 'Fond sombre']);
    expect(conceptPoints({ brief: 'Une scène.', points: 'non' as never })).toEqual(['Une scène.']);
  });
});
