/**
 * Text blocks and arrows drawn over a thumbnail. Positions and sizes are
 * relative to the image (0–1), so the on-screen overlay and the
 * full-resolution render share one layout whatever the display size.
 */

export interface TextBlock {
  id: string;
  /** Absent on blocks saved before arrows existed. */
  kind?: 'text';
  text: string;
  /** Centre of the block, as a fraction of the image width / height. */
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** Font size as a fraction of the image height. */
  size: number;
  /** Google Fonts family (see lib/fonts.ts). */
  font: string;
  bold: boolean;
  color: string;
  /** Box behind the text, or null for none. */
  background: string | null;
}

export type ArrowHead = 'filled' | 'open' | 'double';

/** A curved arrow: a quadratic curve from its start to its tip. */
export interface ArrowBlock {
  id: string;
  kind: 'arrow';
  /** Start and tip, as fractions of the image width / height. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Curvature: how far the middle bulges sideways, in multiples of the length (0 = straight, negative = the other side). */
  bend: number;
  /** Line thickness as a fraction of the image height. */
  width: number;
  color: string;
  head: ArrowHead;
  dashed: boolean;
  /** Border colour, or null for none. */
  outline: string | null;
  shadow: boolean;
}

export type LayerBlock = TextBlock | ArrowBlock;

export function isArrow(block: LayerBlock): block is ArrowBlock {
  return block.kind === 'arrow';
}

/** Whether the block draws anything (an empty text doesn't). */
export function isVisible(block: LayerBlock): boolean {
  return isArrow(block) || !!block.text.trim();
}

/** Shared metrics, in multiples of the font size: the overlay (CSS) and the render (canvas) both use them. */
export const LINE_HEIGHT = 1.15;
export const PADDING_X = 0.35;
export const PADDING_Y = 0.15;
export const RADIUS = 0.2;

export function newTextBlock(font: string, partial: Partial<TextBlock> = {}): TextBlock {
  return {
    id: `t_${Math.random().toString(36).slice(2, 10)}`,
    text: 'TEXTE',
    x: 0.5,
    y: 0.5,
    rotation: 0,
    size: 0.12,
    font,
    bold: true,
    color: '#ffffff',
    background: '#111111',
    ...partial,
  };
}

export function newArrowBlock(partial: Partial<ArrowBlock> = {}): ArrowBlock {
  return {
    id: `a_${Math.random().toString(36).slice(2, 10)}`,
    kind: 'arrow',
    x1: 0.3,
    y1: 0.3,
    x2: 0.55,
    y2: 0.6,
    bend: 0.3,
    width: 0.02,
    color: '#ff2d2d',
    head: 'filled',
    dashed: false,
    outline: '#ffffff',
    shadow: true,
    ...partial,
  };
}

type Pt = { x: number; y: number };

export interface ArrowGeometry {
  start: Pt;
  tip: Pt;
  control: Pt;
  /** Point on the curve halfway along (where the bend handle sits). */
  middle: Pt;
  /** SVG path data, in pixels: the line, then the heads. Also usable with `new Path2D()`. */
  shaft: string;
  heads: string[];
  /** Line and border thicknesses in pixels. */
  stroke: number;
  border: number;
}

/** The arrow's shapes in a `width` × `height` image: the same for the overlay (SVG) and the render (canvas). */
export function arrowGeometry(a: ArrowBlock, width: number, height: number): ArrowGeometry {
  const start = { x: a.x1 * width, y: a.y1 * height };
  const tip = { x: a.x2 * width, y: a.y2 * height };
  const dx = tip.x - start.x;
  const dy = tip.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const mid = { x: (start.x + tip.x) / 2, y: (start.y + tip.y) / 2 };
  const control = { x: mid.x - (dy / length) * a.bend * length, y: mid.y + (dx / length) * a.bend * length };
  const middle = { x: (start.x + 2 * control.x + tip.x) / 4, y: (start.y + 2 * control.y + tip.y) / 4 };
  const stroke = Math.max(1, a.width * height);
  const border = a.outline ? stroke * 0.35 : 0;
  // Head size follows the line, capped so a short arrow stays an arrow.
  const headLength = Math.min(stroke * 3.2, length * 0.45);
  const headHalf = headLength * 0.7;

  const heads: string[] = [];
  // Where the line stops: under a filled head, so its round end doesn't poke out of the tip.
  const ends = [start, tip];
  const at = (end: Pt, from: Pt, index: number) => {
    const ux = end.x - from.x;
    const uy = end.y - from.y;
    const ul = Math.hypot(ux, uy) || 1;
    const t = { x: ux / ul, y: uy / ul };
    const base = { x: end.x - t.x * headLength, y: end.y - t.y * headLength };
    const left = { x: base.x - t.y * headHalf, y: base.y + t.x * headHalf };
    const right = { x: base.x + t.y * headHalf, y: base.y - t.x * headHalf };
    if (a.head === 'open') {
      heads.push(`M${left.x} ${left.y}L${end.x} ${end.y}L${right.x} ${right.y}`);
      ends[index] = { x: end.x - t.x * stroke * 0.5, y: end.y - t.y * stroke * 0.5 };
    } else {
      heads.push(`M${end.x} ${end.y}L${left.x} ${left.y}L${right.x} ${right.y}Z`);
      ends[index] = { x: end.x - t.x * headLength * 0.8, y: end.y - t.y * headLength * 0.8 };
    }
  };
  at(tip, control, 1);
  if (a.head === 'double') at(start, control, 0);

  const shaft = `M${ends[0].x} ${ends[0].y}Q${control.x} ${control.y} ${ends[1].x} ${ends[1].y}`;
  return { start, tip, control, middle, shaft, heads, stroke, border };
}

/** The bend that puts the curve's middle at `p` (pixels), projected on the arrow's normal. */
export function bendThrough(a: ArrowBlock, p: Pt, width: number, height: number): number {
  const start = { x: a.x1 * width, y: a.y1 * height };
  const tip = { x: a.x2 * width, y: a.y2 * height };
  const dx = tip.x - start.x;
  const dy = tip.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  // The curve's middle is halfway between the chord's middle and the control point.
  const off = { x: 2 * (p.x - (start.x + tip.x) / 2), y: 2 * (p.y - (start.y + tip.y) / 2) };
  const bend = (off.x * -dy + off.y * dx) / (length * length);
  return Math.max(-1, Math.min(1, Math.round(bend * 100) / 100));
}

/** Dash pattern for a dashed line of thickness `stroke`. */
export function dashPattern(stroke: number): number[] {
  return [stroke * 1.6, stroke * 1.4];
}

export function drawArrow(ctx: CanvasRenderingContext2D, a: ArrowBlock, width: number, height: number): void {
  const g = arrowGeometry(a, width, height);
  const shaft = new Path2D(g.shaft);
  const heads = g.heads.map((d) => new Path2D(d));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Shadow and border are drawn under the whole arrow at once.
  const layer = (color: string, extra: number) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = g.stroke + extra;
    ctx.setLineDash(a.dashed ? dashPattern(g.stroke) : []);
    ctx.stroke(shaft);
    ctx.setLineDash([]);
    for (const head of heads) {
      if (a.head === 'open') ctx.stroke(head);
      else {
        ctx.lineWidth = extra || 0.0001;
        if (extra) ctx.stroke(head);
        ctx.fill(head);
      }
    }
  };
  if (a.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = g.stroke * 1.5;
    ctx.shadowOffsetY = g.stroke * 0.4;
    layer(a.outline ?? a.color, 2 * g.border);
    ctx.restore();
  }
  if (a.outline) layer(a.outline, 2 * g.border);
  layer(a.color, 0);
  ctx.restore();
}

export function cssFont(block: TextBlock, px: number): string {
  return `${block.bold ? 'bold' : 'normal'} ${px}px "${block.font}", sans-serif`;
}

/** Rotation from the block centre to a pointer, snapped to the nearest 15° when `snap`, and to 0 when close. */
export function rotationTowards(cx: number, cy: number, px: number, py: number, snap = false): number {
  // The handle sits above the block, so "straight up" means no rotation.
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
  deg = ((deg + 540) % 360) - 180;
  if (snap) return Math.round(deg / 15) * 15;
  return Math.abs(deg) < 4 ? 0 : Math.round(deg);
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Draws the blocks onto a context that covers the whole image (width × height). Fonts must be loaded. */
export function drawTextBlocks(ctx: CanvasRenderingContext2D, width: number, height: number, blocks: LayerBlock[]): void {
  for (const block of blocks) {
    if (isArrow(block)) {
      drawArrow(ctx, block, width, height);
      continue;
    }
    const lines = block.text.split('\n');
    if (!lines.some((l) => l.trim())) continue;
    const px = block.size * height;
    ctx.save();
    ctx.translate(block.x * width, block.y * height);
    ctx.rotate((block.rotation * Math.PI) / 180);
    ctx.font = cssFont(block, px);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxW = textWidth + 2 * PADDING_X * px;
    const boxH = lines.length * LINE_HEIGHT * px + 2 * PADDING_Y * px;
    if (block.background) {
      ctx.fillStyle = block.background;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, RADIUS * px);
      ctx.fill();
    }
    ctx.fillStyle = block.color;
    lines.forEach((line, i) => {
      const y = (i - (lines.length - 1) / 2) * LINE_HEIGHT * px;
      ctx.fillText(line, 0, y);
    });
    ctx.restore();
  }
}
