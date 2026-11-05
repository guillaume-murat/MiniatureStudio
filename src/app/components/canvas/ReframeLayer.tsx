import { useRef, useState } from 'react';
import { Check, Lasso, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { SafeZones } from './SafeZones';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { fit, useElementSize } from '../../hooks/use-element-size';
import { usePinch } from '../../hooks/use-pinch';
import { useReframe } from '../../stores/reframe';
import { useWorkspace } from '../../stores/workspace';
import { hasGaps, imageRect, isIdentity, isZone, MAX_REFRAME_SCALE, MIN_REFRAME_SCALE, NO_REFRAME, zoomReframeAt, type Point } from '../../lib/reframe';
import { useT } from '../../i18n';
import type { Generation } from '../../lib/types';

/** CSS polygon from points in fractions of the element. */
function cssPolygon(points: Point[]): string {
  return `polygon(${points.map((p) => `${p.x * 100}% ${p.y * 100}%`).join(', ')})`;
}

function svgPoints(points: Point[], width: number, height: number): string {
  return points.map((p) => `${p.x * width},${p.y * height}`).join(' ');
}

/**
 * The frame (the output, same size as the image) with the image inside it:
 * drag or two-finger scroll to move, pinch to zoom. Parts outside the
 * frame stay faintly visible; uncovered parts of the frame show a checkerboard.
 * In zone mode, a freehand zone is drawn first and only that zone moves.
 */
export function ReframeView({ gen }: { gen: Generation }) {
  const { value, set, target, zone, setZone } = useReframe();
  const [draft, setDraft] = useState<Point[] | null>(null);
  // Drawing the zone: the image stays put and the pointer traces its outline.
  const drawing = target === 'zone' && !isZone(zone);
  const safeZones = useWorkspace((s) => s.safeZones);
  const url = useBlobUrl(gen.blob);
  const [ref, box] = useElementSize<HTMLDivElement>();
  // Leave room around the frame to see what gets cropped off.
  const size = fit(gen.width / gen.height, { width: box.width * 0.72, height: box.height * 0.72 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const rect = imageRect(value, size.width, size.height);

  usePinch(ref, {
    onZoom: (factor, clientX, clientY) => {
      const r = frame.current?.getBoundingClientRect();
      if (!r || drawing) return;
      const p = { x: (clientX - (r.left + r.width / 2)) / r.width, y: (clientY - (r.top + r.height / 2)) / r.height };
      set((v) => zoomReframeAt(v, factor, p));
    },
    onPan: (dx, dy) => {
      if (drawing) return false;
      set((v) => ({ ...v, x: v.x - dx / size.width, y: v.y - dy / size.height }));
      return true;
    },
  });

  const imgStyle = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  const frameBg = { background: 'repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%) 50% / 20px 20px' };

  function framePoint(e: React.PointerEvent): Point {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }

  const zoneMoves = target === 'zone' && isZone(zone);
  // Image left in place, with a hole where the zone was.
  const holed = zoneMoves
    ? `path(evenodd, 'M0 0H${size.width}V${size.height}H0Z M${zone.map((p) => `${p.x * size.width} ${p.y * size.height}`).join(' L')}Z')`
    : undefined;
  const movedClip = zoneMoves ? cssPolygon(zone) : undefined;
  const outline = zoneMoves ? zone.map((p) => ({ x: (rect.left + p.x * rect.width) / size.width, y: (rect.top + p.y * rect.height) / size.height })) : null;

  return (
    <div ref={ref} className="relative flex size-full items-center justify-center overflow-hidden">
      {size.width > 0 && (
        <div
          ref={frame}
          className={drawing ? 'relative cursor-crosshair touch-none' : 'relative cursor-grab touch-none active:cursor-grabbing'}
          style={size}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            if (drawing) setDraft([framePoint(e)]);
            else drag.current = { x: value.x, y: value.y, startX: e.clientX, startY: e.clientY };
          }}
          onPointerMove={(e) => {
            if (draft) {
              const p = framePoint(e);
              const last = draft[draft.length - 1];
              if (Math.hypot((p.x - last.x) * size.width, (p.y - last.y) * size.height) > 3) setDraft([...draft, p]);
              return;
            }
            const d = drag.current;
            if (d) set({ ...value, x: d.x + (e.clientX - d.startX) / size.width, y: d.y + (e.clientY - d.startY) / size.height });
          }}
          onPointerUp={() => {
            if (draft) setZone(isZone(draft) ? draft : null);
            setDraft(null);
            drag.current = null;
          }}
          onPointerCancel={() => {
            setDraft(null);
            drag.current = null;
          }}
        >
          {/* What falls outside the frame, faded */}
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none opacity-25 select-none"
            style={{ ...imgStyle, clipPath: movedClip }}
          />
          {/* The frame: checkerboard where nothing covers it, the image on top */}
          <div className="absolute inset-0 overflow-hidden rounded-lg ring-2 ring-highlight" style={frameBg}>
            {zoneMoves && (
              <img src={url} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full max-w-none select-none" style={{ clipPath: holed }} />
            )}
            <img
              src={url}
              alt={gen.prompt}
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ ...imgStyle, clipPath: movedClip }}
            />
            {safeZones && <SafeZones aspectRatio={gen.params.aspectRatio} />}
          </div>
          {(draft || outline) && (
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${size.width} ${size.height}`}>
              {draft ? (
                <polyline points={svgPoints(draft, size.width, size.height)} fill="none" stroke="white" strokeWidth={2} strokeDasharray="6 4" />
              ) : (
                outline && (
                  <polygon points={svgPoints(outline, size.width, size.height)} fill="none" stroke="white" strokeWidth={2} strokeDasharray="6 4" />
                )
              )}
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

export function ReframeToolbar() {
  const t = useT();
  const { value, set, target, setTarget, zone, setZone } = useReframe();
  const { reframe, setTool } = useWorkspace();
  const [applying, setApplying] = useState(false);
  const byZone = target === 'zone';
  // A moved zone always leaves something for the model: its old place and its outline.
  const gaps = byZone ? isZone(zone) && !isIdentity(value) : hasGaps(value);
  const ready = !isIdentity(value) && (!byZone || isZone(zone));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup type="single" size="sm" variant="outline" value={target} onValueChange={(v) => v && setTarget(v as typeof target)}>
        <ToggleGroupItem value="image" className="px-2.5 text-xs">
          {t('reframe.wholeImage')}
        </ToggleGroupItem>
        <ToggleGroupItem value="zone" className="gap-1 px-2.5 text-xs">
          <Lasso className="size-3.5" /> {t('reframe.zone')}
        </ToggleGroupItem>
      </ToggleGroup>
      {byZone && isZone(zone) && (
        <Button variant="ghost" size="sm" onClick={() => setZone(null)}>
          <Lasso /> {t('reframe.redraw')}
        </Button>
      )}
      <span className="text-xs text-muted-foreground">{t('reframe.zoom')}</span>
      <Slider
        className="w-32"
        min={MIN_REFRAME_SCALE}
        max={MAX_REFRAME_SCALE}
        step={0.01}
        value={[value.scale]}
        onValueChange={([scale]) => set({ ...value, scale })}
        aria-label={t('reframe.zoom')}
      />
      <span className="tabular w-11 text-xs">{Math.round(value.scale * 100)} %</span>
      <Button variant="ghost" size="sm" onClick={() => set(NO_REFRAME)} disabled={isIdentity(value)}>
        <RotateCcw /> {t('reframe.reset')}
      </Button>
      {gaps && (
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          <Sparkles className="size-3" /> {t('reframe.aiFill')}
        </span>
      )}
      <div className="ml-auto flex flex-wrap justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setTool(null)}>
          <X /> {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          disabled={applying || !ready}
          onClick={async () => {
            setApplying(true);
            await reframe(value, byZone ? zone : null);
            setApplying(false);
          }}
        >
          {applying ? <Loader2 className="animate-spin" /> : <Check />} {t('text.apply')}
        </Button>
      </div>
    </div>
  );
}
