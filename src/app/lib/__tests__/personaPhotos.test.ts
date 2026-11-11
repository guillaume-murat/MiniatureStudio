import { describe, expect, it } from 'vitest';
import { canUse, MAX_PERSONA_PHOTOS, MAX_USED_PHOTOS, normalisePhotos, tick, usedPhotos } from '../personaPhotos';

const blob = (s: string) => new Blob([s]);

describe('a person’s photos', () => {
  it('keeps up to 10 photos, of which 4 are sent', () => {
    expect(MAX_PERSONA_PHOTOS).toBe(10);
    expect(MAX_USED_PHOTOS).toBe(4);
  });

  it('turns the former angles and expressions into plain photos: front, left, right, then the rest, the first 4 ticked', () => {
    const photos = normalisePhotos([
      { id: 'e1', slot: 'expression', expression: 'surpris', blob: blob('e1') },
      { id: 'r', slot: 'right', blob: blob('r') },
      { id: 'f', slot: 'front', blob: blob('f') },
      { id: 'e2', slot: 'expression', expression: 'rire', blob: blob('e2') },
      { id: 'l', slot: 'left', blob: blob('l') },
    ]);
    expect(photos.map((p) => [p.id, p.used])).toEqual([
      ['f', true],
      ['l', true],
      ['r', true],
      ['e1', true],
      ['e2', false],
    ]);
    expect(photos.every((p) => !('slot' in p) && !('expression' in p))).toBe(true);
  });

  it('keeps the ticks already chosen, at most 4, and at most 10 photos', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, blob: blob(String(i)), used: i % 2 === 0 }));
    const photos = normalisePhotos(many);
    expect(photos).toHaveLength(10);
    expect(photos.filter((p) => p.used).map((p) => p.id)).toEqual(['p0', 'p2', 'p4', 'p6']);
  });

  it('sends only the ticked photos', () => {
    const photos = normalisePhotos([
      { id: 'a', blob: blob('a'), used: false },
      { id: 'b', blob: blob('b'), used: true },
    ]);
    expect(usedPhotos(photos).map((p) => p.id)).toEqual(['b']);
  });

  it('lets a photo be ticked only while fewer than 4 are', () => {
    const photos = normalisePhotos(Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, blob: blob(String(i)), used: i < 4 })));
    expect(canUse(photos, 'p4')).toBe(false);
    expect(canUse(photos, 'p0')).toBe(true);
    expect(canUse(normalisePhotos([{ id: 'x', blob: blob('x'), used: false }]), 'x')).toBe(true);
  });
});

describe('the order of the ticks', () => {
  const four = () => normalisePhotos(['a', 'b', 'c', 'd'].map((id) => ({ id, blob: blob(id), used: false })));

  it('numbers the ticked photos 1 to 4 in the order they were ticked, and sends them in that order', () => {
    let photos = four();
    for (const id of ['c', 'a', 'd']) photos = tick(photos, id, true);
    expect(photos.map((p) => [p.id, p.rank ?? null])).toEqual([
      ['a', 2],
      ['b', null],
      ['c', 1],
      ['d', 3],
    ]);
    expect(usedPhotos(photos).map((p) => p.id)).toEqual(['c', 'a', 'd']);
  });

  it('closes the gap when a photo is unticked', () => {
    let photos = four();
    for (const id of ['c', 'a', 'd']) photos = tick(photos, id, true);
    photos = tick(photos, 'c', false);
    expect(usedPhotos(photos).map((p) => [p.id, p.rank])).toEqual([
      ['a', 1],
      ['d', 2],
    ]);
    const c = photos.find((p) => p.id === 'c');
    expect(c?.used).toBe(false);
    expect(c?.rank).toBeUndefined();
  });

  it('numbers photos ticked before the numbers existed in their grid order', () => {
    const photos = normalisePhotos([
      { id: 'x', blob: blob('x'), used: true },
      { id: 'y', blob: blob('y'), used: false },
      { id: 'z', blob: blob('z'), used: true },
    ]);
    expect(usedPhotos(photos).map((p) => [p.id, p.rank])).toEqual([
      ['x', 1],
      ['z', 2],
    ]);
  });
});
