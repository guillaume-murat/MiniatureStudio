/**
 * Where the edit bar sits: an offset from its default place, centred at the
 * bottom of the area around the image, in pixels (y is negative going up).
 */
export interface BarOffset {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Between the bar and the area's sides, as at its default place. */
const MARGIN = 8;

/** `+ 0` so that a position at the limit is never -0. */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) + 0;

/** The offset to show: the bar stays whole inside the area, whatever was saved and whatever their sizes are now. */
export function clampBarOffset(offset: BarOffset | null, area: Size, bar: Size): BarOffset {
  if (!offset) return { x: 0, y: 0 };
  const maxSideways = Math.max(0, (area.width - bar.width) / 2 - MARGIN);
  const maxUp = Math.max(0, area.height - bar.height - 2 * MARGIN);
  return { x: clamp(offset.x, -maxSideways, maxSideways), y: clamp(offset.y, -maxUp, 0) };
}

/** A position read back from the preferences, or null for the default place. */
export function parseBarOffset(saved: unknown): BarOffset | null {
  const { x, y } = (saved ?? {}) as Partial<BarOffset>;
  return Number.isFinite(x) && Number.isFinite(y) && typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
}
