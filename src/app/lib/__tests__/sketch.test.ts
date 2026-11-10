import { describe, expect, it } from 'vitest';
import { addStroke, EMPTY_SKETCH, isEmptySketch, isSketch, renderSketch, sketchSize, undoStroke, type SketchStroke } from '../sketch';

const brush: SketchStroke = { tool: 'brush', points: [0.1, 0.2, 0.5, 0.6] };
const eraser: SketchStroke = { tool: 'eraser', points: [0.5, 0.5] };

/** A 2D context that records what is drawn. */
function recorder() {
  const calls: string[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    fillRect: (x: number, y: number, w: number, h: number) => calls.push(`fill ${ctx.fillStyle} ${x} ${y} ${w} ${h}`),
    beginPath: () => {},
    moveTo: (x: number, y: number) => calls.push(`move ${x} ${y}`),
    lineTo: (x: number, y: number) => calls.push(`line ${x} ${y}`),
    stroke: () => calls.push(`stroke ${ctx.strokeStyle} ${ctx.lineWidth}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('the sketch', () => {
  it('starts empty and keeps its strokes in order', () => {
    expect(isEmptySketch(EMPTY_SKETCH)).toBe(true);
    const s = addStroke(addStroke(EMPTY_SKETCH, brush), eraser);
    expect(s.strokes).toEqual([brush, eraser]);
    expect(isEmptySketch(s)).toBe(false);
  });

  it('undoes the last stroke, several times in a row, and stays empty when nothing is left', () => {
    const s = addStroke(addStroke(EMPTY_SKETCH, brush), eraser);
    expect(undoStroke(s).strokes).toEqual([brush]);
    expect(undoStroke(undoStroke(s))).toEqual(EMPTY_SKETCH);
    expect(undoStroke(EMPTY_SKETCH)).toEqual(EMPTY_SKETCH);
  });

  it('is empty with only eraser strokes', () => {
    expect(isEmptySketch(addStroke(EMPTY_SKETCH, eraser))).toBe(true);
  });

  it('ignores a stroke without points', () => {
    expect(addStroke(EMPTY_SKETCH, { tool: 'brush', points: [] })).toEqual(EMPTY_SKETCH);
  });

  it('has the output format of the thumbnail', () => {
    expect(sketchSize('16:9')).toEqual({ width: 1280, height: 720 });
    expect(sketchSize('9:16')).toEqual({ width: 720, height: 1280 });
  });

  it('renders on a white sheet, black for the brush, white for the eraser, in sheet coordinates', () => {
    const { ctx, calls } = recorder();
    renderSketch(ctx, addStroke(addStroke(EMPTY_SKETCH, brush), eraser), 1280, 720);
    expect(calls[0]).toBe('fill #ffffff 0 0 1280 720');
    expect(calls).toContain('move 128 144');
    expect(calls).toContain('line 640 432');
    const strokes = calls.filter((c) => c.startsWith('stroke'));
    expect(strokes[0]).toMatch(/^stroke #000000 /);
    expect(strokes[1]).toMatch(/^stroke #ffffff /);
    // The eraser is wider than the brush.
    expect(Number(strokes[1].split(' ')[2])).toBeGreaterThan(Number(strokes[0].split(' ')[2]));
  });

  it('accepts only well-formed saved sketches', () => {
    expect(isSketch({ strokes: [brush] })).toBe(true);
    expect(isSketch({ strokes: [{ tool: 'pen', points: [] }] })).toBe(false);
    expect(isSketch(undefined)).toBe(false);
  });
});
