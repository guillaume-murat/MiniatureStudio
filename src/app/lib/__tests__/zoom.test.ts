import { describe, expect, it } from 'vitest';
import { clampPan, MAX_VIEW_ZOOM, NO_ZOOM, zoomAt } from '../zoom';

const size = { width: 800, height: 450 };

describe('view zoom', () => {
  it('zooms around the cursor and back to fit', () => {
    const z2 = zoomAt(NO_ZOOM, 2, { x: 100, y: 50 }, size);
    expect(z2).toEqual({ z: 2, x: -100, y: -50 }); // the point under the cursor stays put
    expect(zoomAt(z2, 0.1, { x: 0, y: 0 }, size)).toEqual(NO_ZOOM);
    expect(zoomAt(NO_ZOOM, 100, { x: 0, y: 0 }, size).z).toBe(MAX_VIEW_ZOOM);
  });

  it('never pans an empty margin into view', () => {
    expect(clampPan({ z: 2, x: 1000, y: -1000 }, 800, 450)).toEqual({ z: 2, x: 400, y: -225 });
  });
});
