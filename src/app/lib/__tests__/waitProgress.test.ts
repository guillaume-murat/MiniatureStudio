import { describe, expect, it } from 'vitest';
import { waitProgress, WAIT_MS } from '../waitProgress';

describe('the waiting bar', () => {
  it('fills evenly up to 90 % in 30 seconds', () => {
    expect(WAIT_MS).toBe(30_000);
    expect(waitProgress(0)).toBe(0);
    expect(waitProgress(15_000)).toBeCloseTo(0.45);
    expect(waitProgress(30_000)).toBeCloseTo(0.9);
  });

  it('then creeps on, ever slower, never reaching the end before the image comes', () => {
    const later = [45_000, 60_000, 120_000, 600_000].map(waitProgress);
    for (let i = 1; i < later.length; i++) expect(later[i]).toBeGreaterThan(later[i - 1]);
    expect(later[0]).toBeGreaterThan(0.9);
    expect(later.at(-1)).toBeLessThan(0.99);
  });

  it('ignores a negative time', () => {
    expect(waitProgress(-500)).toBe(0);
  });
});
