import { describe, expect, it } from 'vitest';
import { diffuseFill } from '../smooth';

/** A width × height RGBA image from a per-pixel grey level. */
function image(width: number, height: number, grey: (x: number, y: number) => number) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = grey(x, y);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

describe('diffuseFill', () => {
  it('fills a hole in a flat area with the surrounding colour', () => {
    const rgba = image(20, 20, (x, y) => (x >= 8 && x < 12 && y >= 8 && y < 12 ? 0 : 200));
    const mask = new Float32Array(400).map((_, i) => (i % 20 >= 8 && i % 20 < 12 && Math.floor(i / 20) >= 8 && Math.floor(i / 20) < 12 ? 1 : 0));
    diffuseFill(rgba, 20, 20, mask);
    expect(rgba[(10 * 20 + 10) * 4]).toBeGreaterThanOrEqual(198);
  });

  it('bridges a seam with a gradient between both sides', () => {
    // Dark left half, light right half, a painted 4 px seam in the middle.
    const rgba = image(40, 10, (x) => (x < 20 ? 40 : 200));
    const mask = new Float32Array(400).map((_, i) => (i % 40 >= 18 && i % 40 < 22 ? 1 : 0));
    diffuseFill(rgba, 40, 10, mask);
    const row = [17, 18, 19, 20, 21, 22].map((x) => rgba[(5 * 40 + x) * 4]);
    expect(row[0]).toBe(40);
    expect(row[5]).toBe(200);
    // Strictly increasing across the filled seam: no hard step left.
    for (let i = 1; i < row.length; i++) expect(row[i]).toBeGreaterThan(row[i - 1]);
  });

  it('leaves unpainted pixels untouched', () => {
    const rgba = image(10, 10, (x, y) => (x * 7 + y * 3) % 255);
    const before = rgba.slice();
    const mask = new Float32Array(100);
    mask[55] = 1;
    diffuseFill(rgba, 10, 10, mask);
    for (let i = 0; i < 100; i++) if (i !== 55) expect(rgba[i * 4]).toBe(before[i * 4]);
  });
});
