/**
 * Reframing: the image is moved and scaled inside a frame of its own size.
 * Uncovered parts of the frame are left to the image model to fill in.
 */

export interface Reframe {
  /** Image size relative to the frame (1 = fills it exactly). */
  scale: number;
  /** Offset of the image centre from the frame centre, in fractions of the frame width / height. */
  x: number;
  y: number;
}

export const NO_REFRAME: Reframe = { scale: 1, x: 0, y: 0 };
export const MIN_REFRAME_SCALE = 0.3;
export const MAX_REFRAME_SCALE = 4;
/** Colour of the empty areas sent to the model (the usual outpainting convention). */
export const GAP_COLOR = '#808080';

/** Where the image lands in a frame of `width` × `height`. */
export function imageRect(t: Reframe, width: number, height: number) {
  const w = width * t.scale;
  const h = height * t.scale;
  return { left: width / 2 + t.x * width - w / 2, top: height / 2 + t.y * height - h / 2, width: w, height: h };
}

/** True when part of the frame is not covered by the image. */
export function hasGaps(t: Reframe): boolean {
  const r = imageRect(t, 1, 1);
  const e = 1e-3;
  return r.left > e || r.top > e || r.left + r.width < 1 - e || r.top + r.height < 1 - e;
}

export function isIdentity(t: Reframe): boolean {
  return Math.abs(t.scale - 1) < 1e-3 && Math.abs(t.x) < 1e-3 && Math.abs(t.y) < 1e-3;
}

/** Scales by `factor` keeping the point `p` (fractions of the frame, from its centre) in place. */
export function zoomReframeAt(t: Reframe, factor: number, p: { x: number; y: number }): Reframe {
  const scale = Math.min(MAX_REFRAME_SCALE, Math.max(MIN_REFRAME_SCALE, t.scale * factor));
  const k = scale / t.scale;
  return { scale, x: p.x + (t.x - p.x) * k, y: p.y + (t.y - p.y) * k };
}

/**
 * Draws the reframed image at its own resolution, empty areas in GAP_COLOR.
 * `mask` (white = to fill) is null when the image covers the whole frame.
 */
export async function composeReframe(image: Blob, t: Reframe): Promise<{ composed: Blob; mask: HTMLCanvasElement | null; width: number; height: number }> {
  const bmp = await createImageBitmap(image);
  const { width, height } = bmp;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = GAP_COLOR;
  ctx.fillRect(0, 0, width, height);
  const r = imageRect(t, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, r.left, r.top, r.width, r.height);
  bmp.close();

  let mask: HTMLCanvasElement | null = null;
  if (hasGaps(t)) {
    mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const m = mask.getContext('2d')!;
    m.fillStyle = '#fff';
    m.fillRect(0, 0, width, height);
    // Let the fill overlap the image edge a little, so the seam is blended away.
    const overlap = Math.round(Math.max(width, height) * 0.006);
    m.clearRect(r.left + overlap, r.top + overlap, r.width - 2 * overlap, r.height - 2 * overlap);
  }

  const composed = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
  return { composed, mask, width, height };
}
