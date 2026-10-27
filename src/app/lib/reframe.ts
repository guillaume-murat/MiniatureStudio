/**
 * Reframing: the image (or a freehand zone of it) is moved and scaled inside
 * a frame of its own size. Uncovered parts are left to the image model to fill in.
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

/** A point in fractions of the image (0–1). */
export interface Point {
  x: number;
  y: number;
}

/** A freehand zone is usable once it encloses a visible area (fractions of the image). */
export function isZone(points: Point[] | null | undefined): points is Point[] {
  return !!points && points.length >= 3 && Math.abs(polygonArea(points)) > 1e-3;
}

/** Signed area (shoelace formula). */
export function polygonArea(points: Point[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Where the zone lands once the image is reframed by `t`, in pixels of a `width` × `height` frame. */
export function movedZone(points: Point[], t: Reframe, width: number, height: number): Point[] {
  const r = imageRect(t, width, height);
  return points.map((p) => ({ x: r.left + p.x * r.width, y: r.top + p.y * r.height }));
}

/**
 * The edges of the moved zone that show a cut: all of them except those lying
 * on (or beyond) a side of the frame, where nothing is next to them.
 */
export function seamEdges(points: Point[], width: number, height: number): Array<[Point, Point]> {
  const e = 0.01 * Math.max(width, height);
  const outside = (a: Point, b: Point) =>
    (a.x <= e && b.x <= e) || (a.y <= e && b.y <= e) || (a.x >= width - e && b.x >= width - e) || (a.y >= height - e && b.y >= height - e);
  return points.map((a, i): [Point, Point] => [a, points[(i + 1) % points.length]]).filter(([a, b]) => !outside(a, b));
}

/** Width of the repainted band along a moved zone's cut, as a fraction of the image's longer side. */
export const SEAM_BAND = 0.03;

function seamPath(points: Point[], width: number, height: number): Path2D {
  const path = new Path2D();
  for (const [a, b] of seamEdges(points, width, height)) {
    path.moveTo(a.x, a.y);
    path.lineTo(b.x, b.y);
  }
  return path;
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/**
 * Moves only a freehand zone of the image; everything outside it stays put.
 * Where the zone was and isn't any more is painted GAP_COLOR, and so is a band
 * along the moved zone's cut edges, so the model repaints the transition;
 * `mask` (white = to fill) covers both.
 */
export async function composeZoneReframe(
  image: Blob,
  t: Reframe,
  zone: Point[],
): Promise<{ composed: Blob; mask: HTMLCanvasElement; width: number; height: number }> {
  const bmp = await createImageBitmap(image);
  const { width, height } = bmp;
  const from = zone.map((p) => ({ x: p.x * width, y: p.y * height }));
  const to = movedZone(zone, t, width, height);
  const r = imageRect(t, width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  ctx.fillStyle = GAP_COLOR;
  tracePolygon(ctx, from);
  ctx.fill();
  ctx.save();
  tracePolygon(ctx, to);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, r.left, r.top, r.width, r.height);
  ctx.restore();
  bmp.close();
  // The cut itself is greyed out too: shown a hard edge, the model copies it instead of blending it.
  const seam = seamPath(to, width, height);
  const band = Math.round(Math.max(width, height) * SEAM_BAND);
  ctx.strokeStyle = GAP_COLOR;
  ctx.lineWidth = band;
  ctx.lineCap = 'round';
  ctx.stroke(seam);

  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const m = mask.getContext('2d')!;
  m.fillStyle = '#fff';
  tracePolygon(m, from);
  m.fill();
  m.globalCompositeOperation = 'destination-out';
  tracePolygon(m, to);
  m.fill();
  m.globalCompositeOperation = 'source-over';
  m.strokeStyle = '#fff';
  m.lineWidth = band;
  m.lineCap = 'round';
  m.stroke(seam);

  const composed = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
  return { composed, mask, width, height };
}
