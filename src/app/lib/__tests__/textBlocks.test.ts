import { describe, expect, it } from 'vitest';
import { arrowGeometry, bendThrough, clamp01, cssFont, isVisible, newArrowBlock, newTextBlock, rotationTowards } from '../textBlocks';

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

describe('arrows', () => {
  const straight = newArrowBlock({ x1: 0, y1: 0.5, x2: 1, y2: 0.5, bend: 0, width: 0.01, head: 'filled' });

  it('places the curve between its ends', () => {
    const g = arrowGeometry(straight, 1000, 500);
    expect(g.start).toEqual({ x: 0, y: 250 });
    expect(g.tip).toEqual({ x: 1000, y: 250 });
    expect(g.control).toEqual({ x: 500, y: 250 });
    expect(g.stroke).toBe(5);
    expect(g.heads).toHaveLength(1);
    // A bend pushes the middle sideways (to the right of the direction of travel: down here).
    const bent = arrowGeometry({ ...straight, bend: 0.2 }, 1000, 500);
    expect(bent.control.y).toBeCloseTo(450);
    expect(bent.middle.y).toBeCloseTo(350);
  });

  it('ends the line under a filled head, at the tip for an open one', () => {
    const filled = arrowGeometry(straight, 1000, 500);
    expect(filled.shaft.endsWith(`${1000 - 16 * 0.8} 250`)).toBe(true);
    expect(arrowGeometry({ ...straight, head: 'open' }, 1000, 500).shaft.endsWith(`${1000 - 2.5} 250`)).toBe(true);
    expect(arrowGeometry({ ...straight, head: 'double' }, 1000, 500).heads).toHaveLength(2);
  });

  it('finds the bend that puts the middle under the pointer', () => {
    const g = arrowGeometry({ ...straight, bend: 0.3 }, 1000, 500);
    expect(bendThrough(straight, g.middle, 1000, 500)).toBeCloseTo(0.3);
    expect(bendThrough(straight, { x: 500, y: 250 }, 1000, 500)).toBe(0);
  });

  it('counts as visible even without text', () => {
    expect(isVisible(straight)).toBe(true);
    expect(isVisible(newTextBlock('Anton', { text: '  ' }))).toBe(false);
  });
});
