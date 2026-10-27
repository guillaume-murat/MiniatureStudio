/**
 * View zoom for the image canvas: a scale and a translation (px) applied to the
 * image box with `transform: translate(x, y) scale(z)` around its centre.
 */
export interface ViewZoom {
  z: number;
  x: number;
  y: number;
}

export const NO_ZOOM: ViewZoom = { z: 1, x: 0, y: 0 };
export const MAX_VIEW_ZOOM = 8;

/** Keeps the zoomed box covering its frame: no empty margin can be panned into view. */
export function clampPan(v: ViewZoom, width: number, height: number): ViewZoom {
  const mx = ((v.z - 1) * width) / 2;
  const my = ((v.z - 1) * height) / 2;
  return { z: v.z, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
}

/**
 * Zooms by `factor` keeping the point `d` (cursor, relative to the box centre
 * before transform) where it is on screen. Between 1× (fit) and MAX_VIEW_ZOOM.
 */
export function zoomAt(v: ViewZoom, factor: number, d: { x: number; y: number }, size: { width: number; height: number }): ViewZoom {
  const z = Math.min(MAX_VIEW_ZOOM, Math.max(1, v.z * factor));
  if (z === 1) return NO_ZOOM;
  const k = z / v.z;
  return clampPan({ z, x: d.x - k * (d.x - v.x), y: d.y - k * (d.y - v.y) }, size.width, size.height);
}
