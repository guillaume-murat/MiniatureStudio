/**
 * Text blocks drawn over a thumbnail. Positions and sizes are relative to the
 * image (0–1), so the on-screen overlay and the full-resolution render share
 * one layout whatever the display size.
 */

export interface TextBlock {
  id: string;
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
export function drawTextBlocks(ctx: CanvasRenderingContext2D, width: number, height: number, blocks: TextBlock[]): void {
  for (const block of blocks) {
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
