import { describe, expect, it } from 'vitest';
import { hasGaps, imageRect, isIdentity, MAX_REFRAME_SCALE, NO_REFRAME, zoomReframeAt } from '../reframe';

describe('reframe layout', () => {
  it('places the image in the frame', () => {
    expect(imageRect(NO_REFRAME, 1600, 900)).toEqual({ left: 0, top: 0, width: 1600, height: 900 });
    expect(imageRect({ scale: 1, x: 0, y: 0.2 }, 1600, 900)).toMatchObject({ left: 0, top: 180 });
    expect(imageRect({ scale: 0.5, x: 0, y: 0 }, 1000, 500)).toEqual({ left: 250, top: 125, width: 500, height: 250 });
  });

  it('detects uncovered areas', () => {
    expect(hasGaps(NO_REFRAME)).toBe(false);
    expect(hasGaps({ scale: 1, x: 0, y: 0.1 })).toBe(true); // moved down: empty band on top
    expect(hasGaps({ scale: 0.8, x: 0, y: 0 })).toBe(true); // zoomed out
    expect(hasGaps({ scale: 1.5, x: 0.2, y: 0 })).toBe(false); // zoomed in, still covering
    expect(hasGaps({ scale: 1.5, x: 0.3, y: 0 })).toBe(true);
  });

  it('zooms around a point and stays within limits', () => {
    // Zooming around the frame centre keeps the image centred.
    expect(zoomReframeAt(NO_REFRAME, 2, { x: 0, y: 0 })).toEqual({ scale: 2, x: 0, y: 0 });
    // Around the right edge, the image grows to the left.
    expect(zoomReframeAt(NO_REFRAME, 2, { x: 0.5, y: 0 })).toEqual({ scale: 2, x: -0.5, y: 0 });
    expect(zoomReframeAt(NO_REFRAME, 100, { x: 0, y: 0 }).scale).toBe(MAX_REFRAME_SCALE);
  });

  it('knows when nothing changed', () => {
    expect(isIdentity(NO_REFRAME)).toBe(true);
    expect(isIdentity({ scale: 1, x: 0.01, y: 0 })).toBe(false);
  });
});
