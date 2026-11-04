import { describe, expect, it } from 'vitest';
import { clampBarOffset, parseBarOffset } from '../editBar';

const area = { width: 800, height: 600 };
const bar = { width: 500, height: 100 };

describe('edit bar position', () => {
  it('stays at its default place, centred at the bottom, without an offset', () => {
    expect(clampBarOffset(null, area, bar)).toEqual({ x: 0, y: 0 });
  });

  it('keeps a position that fits', () => {
    expect(clampBarOffset({ x: -60, y: -200 }, area, bar)).toEqual({ x: -60, y: -200 });
  });

  it('stops 8 px from each side of the area', () => {
    expect(clampBarOffset({ x: -1000, y: 0 }, area, bar)).toEqual({ x: -142, y: 0 });
    expect(clampBarOffset({ x: 1000, y: 0 }, area, bar)).toEqual({ x: 142, y: 0 });
    expect(clampBarOffset({ x: 0, y: -1000 }, area, bar)).toEqual({ x: 0, y: -484 });
    expect(clampBarOffset({ x: 0, y: 1000 }, area, bar)).toEqual({ x: 0, y: 0 });
  });

  it('brings it back when the area shrinks or the bar grows', () => {
    const saved = { x: 142, y: -484 };
    expect(clampBarOffset(saved, { width: 600, height: 400 }, bar)).toEqual({ x: 42, y: -284 });
    expect(clampBarOffset(saved, area, { width: 500, height: 200 })).toEqual({ x: 142, y: -384 });
  });

  it('falls back to its default place in an area too small for it', () => {
    expect(clampBarOffset({ x: 50, y: -50 }, { width: 400, height: 90 }, bar)).toEqual({ x: 0, y: 0 });
  });

  it('only takes a saved position with two finite numbers', () => {
    expect(parseBarOffset({ x: -60, y: -200 })).toEqual({ x: -60, y: -200 });
    for (const bad of [undefined, null, 'x', 3, {}, { x: 1 }, { x: '1', y: 2 }, { x: NaN, y: 2 }, { x: 1, y: Infinity }]) {
      expect(parseBarOffset(bad)).toBeNull();
    }
  });
});
