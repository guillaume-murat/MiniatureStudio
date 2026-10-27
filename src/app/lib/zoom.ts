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
/** Zooming out below fit shows the thumbnail small, the way it looks in a feed. */
export const MIN_VIEW_ZOOM = 0.15;

/** Keeps the zoomed box covering its frame (no empty margin panned into view); smaller than its frame, it stays centred. */
export function clampPan(v: ViewZoom, width: number, height: number): ViewZoom {
  if (v.z <= 1) return { z: v.z, x: 0, y: 0 };
  const mx = ((v.z - 1) * width) / 2;
  const my = ((v.z - 1) * height) / 2;
  return { z: v.z, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
}

/**
 * Zooms by `factor` keeping the point `d` (cursor, relative to the box centre
 * before transform) where it is on screen. Between MIN_VIEW_ZOOM and
 * MAX_VIEW_ZOOM; crossing fit (1×) stops there once, so it is easy to land on.
 */
export function zoomAt(v: ViewZoom, factor: number, d: { x: number; y: number }, size: { width: number; height: number }): ViewZoom {
  let z = Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, v.z * factor));
  if ((v.z > 1 && z < 1) || (v.z < 1 && z > 1)) z = 1;
  if (Math.abs(z - 1) < 1e-3) return NO_ZOOM;
  if (z < 1) return { z, x: 0, y: 0 };
  const k = z / v.z;
  return clampPan({ z, x: d.x - k * (d.x - v.x), y: d.y - k * (d.y - v.y) }, size.width, size.height);
}
