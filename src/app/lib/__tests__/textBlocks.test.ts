import { describe, expect, it } from 'vitest';
import { clamp01, cssFont, newTextBlock, rotationTowards } from '../textBlocks';

describe('rotationTowards', () => {
  it('reads the handle straight above as no rotation', () => {
    expect(rotationTowards(0, 0, 0, -10)).toBe(0);
  });
  it('turns clockwise towards the right and snaps near zero', () => {
    expect(rotationTowards(0, 0, 10, 0)).toBe(90);
    expect(rotationTowards(0, 0, -10, 0)).toBe(-90);
    expect(rotationTowards(0, 0, 0.5, -10)).toBe(0);
  });
  it('snaps to 15° steps when asked', () => {
    expect(rotationTowards(0, 0, 10, -8, true) % 15).toBe(0);
  });
});

describe('text blocks', () => {
  it('start centred with readable defaults', () => {
    const b = newTextBlock('Anton');
    expect(b).toMatchObject({ x: 0.5, y: 0.5, rotation: 0, font: 'Anton', bold: true });
    expect(cssFont(b, 40)).toBe('bold 40px "Anton", sans-serif');
  });
  it('keep positions inside the image', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });
});
