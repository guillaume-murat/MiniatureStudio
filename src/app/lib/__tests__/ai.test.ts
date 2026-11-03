import { describe, expect, it } from 'vitest';
import { cleanLayout, conceptsPrompt } from '../ai';

const input = { videoTitle: 'Mars', idea: 'Une fusée', lang: 'fr', styles: [{ id: 'versus', name: 'Versus', hint: 'Comparatifs', prompt: 'Composition divisée en deux.' }] } as const;

describe('conceptsPrompt', () => {
  it('holds what the assistant sends', () => {
    const p = conceptsPrompt({ ...input, styles: [...input.styles] });
    for (const part of ['grand stratège', 'Titre de la vidéo : "Mars"', 'créateur : "Une fusée"', '- versus : Versus (Comparatifs). Composition divisée en deux.', 'rédigée en français']) expect(p).toContain(part);
  });

  it('says when the title or the idea is missing', () => {
    const p = conceptsPrompt({ ...input, styles: [], videoTitle: '', idea: '' });
    expect(p).toContain('(pas encore de titre)');
    expect(p).toContain('(aucune)');
  });
});

describe('cleanLayout', () => {
  it('keeps a good answer', () => {
    const element = { label: 'Créateur', kind: 'person', x: 10, y: 20, w: 30, h: 40, color: '#ff0000' } as const;
    expect(cleanLayout({ background: '#000', elements: [element] })).toEqual({ background: '#000', elements: [element] });
  });

  it('keeps what the model invents drawable and in the frame', () => {
    const raw = { background: 'url(x)', elements: [{ label: 'a', kind: 'cloud', x: 90, y: -5, w: 50, h: 500, color: 'red' }] };
    const { background, elements } = cleanLayout(raw as never);
    expect(background).toBe('#334155');
    expect(elements[0]).toEqual({ label: 'a', kind: 'shape', x: 90, y: 0, w: 10, h: 100, color: '#64748b' });
  });

  it('survives a missing answer', () => {
    expect(cleanLayout(undefined).elements).toEqual([]);
    expect(cleanLayout({ elements: 'none' } as never).elements).toEqual([]);
  });
});
