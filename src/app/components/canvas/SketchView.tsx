import { useEffect, useRef, useState } from 'react';
import { Brush, Eraser, Undo2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { MOD } from '../TopBar';
import { fit, useElementSize } from '../../hooks/use-element-size';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { drawStroke, renderSketch, sketchSize, type SketchStroke, type SketchTool } from '../../lib/sketch';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

/**
 * The Gribouillis view: a white sheet in the thumbnail's format, a fine black
 * brush and an eraser. The sketch is drawn in sheet pixels and kept as strokes
 * relative to the sheet (lib/sketch.ts), in the open project. ⌘Z (App.tsx) undoes the last stroke.
 */
export function SketchView() {
  const t = useT();
  const sketch = useWorkspace((s) => s.sketch);
  const addSketchStroke = useWorkspace((s) => s.addSketchStroke);
  const undoSketchStroke = useWorkspace((s) => s.undoSketchStroke);
  const ratio = useSettings((s) => s.aspectRatio);
  const { width, height } = sketchSize(ratio);
  const [tool, setTool] = useState<SketchTool>('brush');
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const sheet = fit(width / height, { width: Math.max(0, area.width - 48), height: Math.max(0, area.height - 48) });
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The stroke being drawn, committed to the store when the pointer is released. */
  const live = useRef<SketchStroke | null>(null);

  // The whole sketch, each time it changes (a new stroke, an undo, another project or format).
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) renderSketch(ctx, sketch, width, height);
  }, [sketch, width, height]);


  function point(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    // Four decimals: finer than a pixel of the sheet, and light to save.
    const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
  }

  function extend(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = live.current;
    const ctx = canvas.current?.getContext('2d');
    if (!stroke || !ctx) return;
    const from = Math.max(0, stroke.points.length - 2);
    stroke.points.push(...point(e));
    drawStroke(ctx, stroke, width, height, from);
  }

  function finish() {
    const stroke = live.current;
    live.current = null;
    if (stroke) addSketchStroke(stroke);
  }

  return (
    <div ref={areaRef} className="relative flex size-full items-center justify-center pb-24">
      <canvas
        ref={canvas}
        width={width}
        height={height}
        aria-label={t('sketch.sheet')}
        style={{ width: sheet.width, height: sheet.height }}
        className={cn('touch-none rounded-sm border border-border', tool === 'eraser' ? 'cursor-crosshair' : 'cursor-brush')}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          live.current = { tool, points: [] };
          extend(e);
        }}
        onPointerMove={(e) => live.current && extend(e)}
        onPointerUp={finish}
        onPointerCancel={finish}
      />

      <p className="pointer-events-none absolute top-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs text-background">
        {t('sketch.hint')}
      </p>

      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl border-2 border-ink bg-background p-2 shadow-pop-lg">
        <ToggleGroup type="single" size="sm" value={tool} onValueChange={(v) => v && setTool(v as SketchTool)}>
          <ToggleGroupItem value="brush" aria-label={t('sketch.brush')} title={t('sketch.brush')}>
            <Brush /> <span>{t('sketch.brush')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="eraser" aria-label={t('sketch.eraser')} title={t('sketch.eraser')}>
            <Eraser /> <span>{t('sketch.eraser')}</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" disabled={!sketch.strokes.length} onClick={undoSketchStroke}>
              <Undo2 /> {t('sketch.undo')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('sketch.undo')} <Kbd>{MOD}Z</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
