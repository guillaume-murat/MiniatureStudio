import { describe, expect, it } from 'vitest';
import { clampPan, MAX_VIEW_ZOOM, MIN_VIEW_ZOOM, NO_ZOOM, zoomAt } from '../zoom';

const size = { width: 800, height: 450 };

describe('view zoom', () => {
  it('zooms around the cursor and back to fit', () => {
    const z2 = zoomAt(NO_ZOOM, 2, { x: 100, y: 50 }, size);
    expect(z2).toEqual({ z: 2, x: -100, y: -50 }); // the point under the cursor stays put
    // Zooming out stops at fit once…
    expect(zoomAt(z2, 0.1, { x: 0, y: 0 }, size)).toEqual(NO_ZOOM);
    expect(zoomAt(NO_ZOOM, 100, { x: 0, y: 0 }, size).z).toBe(MAX_VIEW_ZOOM);
  });

  it('never pans an empty margin into view', () => {
    expect(clampPan({ z: 2, x: 1000, y: -1000 }, 800, 450)).toEqual({ z: 2, x: 400, y: -225 });
  });

  it('zooms out below fit, centred, down to the minimum', () => {
    // …then goes on below it, the image staying centred whatever the cursor.
    expect(zoomAt(NO_ZOOM, 0.5, { x: 200, y: 100 }, size)).toEqual({ z: 0.5, x: 0, y: 0 });
    expect(zoomAt(NO_ZOOM, 0.01, { x: 0, y: 0 }, size).z).toBe(MIN_VIEW_ZOOM);
    // Zooming back in from small stops at fit too.
    expect(zoomAt({ z: 0.5, x: 0, y: 0 }, 4, { x: 0, y: 0 }, size)).toEqual(NO_ZOOM);
    expect(clampPan({ z: 0.5, x: 30, y: 30 }, 800, 450)).toEqual({ z: 0.5, x: 0, y: 0 });
  });
});
