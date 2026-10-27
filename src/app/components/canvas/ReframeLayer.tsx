import { useRef, useState } from 'react';
import { Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { SafeZones } from './SafeZones';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { fit, useElementSize } from '../../hooks/use-element-size';
import { usePinch } from '../../hooks/use-pinch';
import { useReframe } from '../../stores/reframe';
import { useWorkspace } from '../../stores/workspace';
import { hasGaps, imageRect, isIdentity, MAX_REFRAME_SCALE, MIN_REFRAME_SCALE, zoomReframeAt } from '../../lib/reframe';
import { useT } from '../../i18n';
import type { Generation } from '../../lib/types';

/**
 * The frame (the output, same size as the image) with the image inside it:
 * drag or two-finger scroll to move, pinch to zoom. Parts outside the
 * frame stay faintly visible; uncovered parts of the frame show a checkerboard.
 */
export function ReframeView({ gen }: { gen: Generation }) {
  const { value, set } = useReframe();
  const safeZones = useWorkspace((s) => s.safeZones);
  // A text version moves the image under its text: show that image.
  const url = useBlobUrl(gen.textLayer?.base ?? gen.blob);
  const [ref, box] = useElementSize<HTMLDivElement>();
  // Leave room around the frame to see what gets cropped off.
  const size = fit(gen.width / gen.height, { width: box.width * 0.72, height: box.height * 0.72 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const rect = imageRect(value, size.width, size.height);

  usePinch(ref, {
    onZoom: (factor, clientX, clientY) => {
      const r = frame.current?.getBoundingClientRect();
      if (!r) return;
      const p = { x: (clientX - (r.left + r.width / 2)) / r.width, y: (clientY - (r.top + r.height / 2)) / r.height };
      set((v) => zoomReframeAt(v, factor, p));
    },
    onPan: (dx, dy) => {
      set((v) => ({ ...v, x: v.x - dx / size.width, y: v.y - dy / size.height }));
      return true;
    },
  });

  const imgStyle = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

  return (
    <div ref={ref} className="relative flex size-full items-center justify-center overflow-hidden">
      {size.width > 0 && (
        <div
          ref={frame}
          className="relative cursor-grab touch-none active:cursor-grabbing"
          style={size}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: value.x, y: value.y, startX: e.clientX, startY: e.clientY };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d) set({ ...value, x: d.x + (e.clientX - d.startX) / size.width, y: d.y + (e.clientY - d.startY) / size.height });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* What falls outside the frame, faded */}
          <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none opacity-25 select-none" style={imgStyle} />
          {/* The frame: checkerboard where nothing covers it, the image on top */}
          <div
            className="absolute inset-0 overflow-hidden rounded-lg shadow-lg ring-2 ring-primary"
            style={{ background: 'repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%) 50% / 20px 20px' }}
          >
            <img src={url} alt={gen.prompt} draggable={false} className="pointer-events-none absolute max-w-none select-none" style={imgStyle} />
            {safeZones && <SafeZones aspectRatio={gen.params.aspectRatio} />}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReframeToolbar() {
  const t = useT();
  const { value, set, reset } = useReframe();
  const { reframe, setReframeMode } = useWorkspace();
  const [applying, setApplying] = useState(false);
  const gaps = hasGaps(value);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-2 py-1.5">
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
      <Button variant="ghost" size="sm" onClick={reset} disabled={isIdentity(value)}>
        <RotateCcw /> {t('reframe.reset')}
      </Button>
      {gaps && (
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          <Sparkles className="size-3" /> {t('reframe.aiFill')}
        </span>
      )}
      <div className="ml-auto flex flex-wrap justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setReframeMode(false)}>
          <X /> {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          disabled={applying || isIdentity(value)}
          onClick={async () => {
            setApplying(true);
            await reframe(value);
            setApplying(false);
          }}
        >
          {applying ? <Loader2 className="animate-spin" /> : <Check />} {t('text.apply')}
        </Button>
      </div>
    </div>
  );
}
