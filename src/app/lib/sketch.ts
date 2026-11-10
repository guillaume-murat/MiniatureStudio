import type { OutputRatio } from './types';

/**
 * The sketch (« croquis ») of the Gribouillis view: black lines on a white sheet,
 * sent as image 1 of a generation. Kept as strokes rather than an image, in
 * coordinates relative to the sheet, so it follows a change of output format
 * and stays small in the project's saved inputs.
 */
export type SketchTool = 'brush' | 'eraser';

export interface SketchStroke {
  tool: SketchTool;
  /** x0, y0, x1, y1…, each from 0 to 1 across the sheet. */
  points: number[];
}

export interface Sketch {
  strokes: SketchStroke[];
}

export const EMPTY_SKETCH: Sketch = { strokes: [] };

/** Line widths, as a fraction of the sheet's shorter side: a fine pen, a wider eraser. */
export const BRUSH_WIDTH = 0.006;
export const ERASER_WIDTH = 0.04;

export function addStroke(sketch: Sketch, stroke: SketchStroke): Sketch {
  return stroke.points.length < 2 ? sketch : { strokes: [...sketch.strokes, stroke] };
}

export function undoStroke(sketch: Sketch): Sketch {
  return sketch.strokes.length ? { strokes: sketch.strokes.slice(0, -1) } : sketch;
}

/** Nothing drawn: no brush stroke left (eraser strokes alone draw nothing). */
export function isEmptySketch(sketch: Sketch): boolean {
  return !sketch.strokes.some((s) => s.tool === 'brush');
}

/** The sheet in pixels, in the thumbnail's format: what is drawn and sent. */
export function sketchSize(ratio: OutputRatio): { width: number; height: number } {
  return ratio === '9:16' ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}

export function strokeWidth(tool: SketchTool, width: number, height: number): number {
  return (tool === 'eraser' ? ERASER_WIDTH : BRUSH_WIDTH) * Math.min(width, height);
}

/** Draws one stroke, or its points from `from` on (the live stroke being drawn). */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: SketchStroke, width: number, height: number, from = 0): void {
  const p = stroke.points;
  if (p.length < 2) return;
  const start = Math.max(0, Math.min(from, p.length - 2));
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : '#000000';
  ctx.lineWidth = strokeWidth(stroke.tool, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p[start] * width, p[start + 1] * height);
  // A single point still leaves a dot, thanks to the round cap.
  if (p.length - start === 2) ctx.lineTo(p[start] * width, p[start + 1] * height);
  for (let i = start + 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i] * width, p[i + 1] * height);
  ctx.stroke();
}

/** The whole sketch on a white sheet of `width` × `height` pixels. */
export function renderSketch(ctx: CanvasRenderingContext2D, sketch: Sketch, width: number, height: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  for (const stroke of sketch.strokes) drawStroke(ctx, stroke, width, height);
}

/** The sketch as the PNG sent to the model. */
export async function sketchBlob(sketch: Sketch, ratio: OutputRatio): Promise<Blob> {
  const { width, height } = sketchSize(ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  renderSketch(ctx, sketch, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Sketch export failed'))), 'image/png'));
}

/** A saved sketch read back from IndexedDB or a backup. */
export function isSketch(value: unknown): value is Sketch {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Sketch).strokes)) return false;
  return (value as Sketch).strokes.every(
    (s) => s && (s.tool === 'brush' || s.tool === 'eraser') && Array.isArray(s.points) && s.points.every((n) => typeof n === 'number'),
  );
}
