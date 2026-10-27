import { useEffect, useRef, useState } from 'react';
import { Bold, Check, Loader2, Merge, PaintBucket, Plus, RotateCw, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Slider } from '../ui/slider';
import { Toggle } from '../ui/toggle';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { FontPicker } from '../dialogs/FontPicker';
import { useText } from '../../stores/text';
import { selectedGeneration, useWorkspace } from '../../stores/workspace';
import { loadGoogleFont } from '../../lib/fonts';
import { clamp01, LINE_HEIGHT, PADDING_X, PADDING_Y, RADIUS, rotationTowards, type TextBlock } from '../../lib/textBlocks';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

const TEXT_INPUT_ID = 'text-block-input';

type Drag = { kind: 'move'; id: string; startX: number; startY: number; x: number; y: number } | { kind: 'rotate'; id: string };

/** The blocks over the image: drag to move, drag the round handle to rotate (Shift snaps to 15°). */
export function TextOverlay({ height }: { height: number }) {
  const { blocks, selectedId, select, update } = useText();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  // Make every family on screen available (bundled files for the listed ones).
  useEffect(() => {
    for (const font of new Set(blocks.map((b) => b.font))) loadGoogleFont(font).catch(() => {});
  }, [blocks]);

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const rect = ref.current?.getBoundingClientRect();
    if (!d || !rect) return;
    if (d.kind === 'move') {
      update(d.id, {
        x: clamp01(d.x + (e.clientX - d.startX) / rect.width),
        y: clamp01(d.y + (e.clientY - d.startY) / rect.height),
      });
    } else {
      const block = blocks.find((b) => b.id === d.id);
      if (!block) return;
      const cx = rect.left + block.x * rect.width;
      const cy = rect.top + block.y * rect.height;
      update(d.id, { rotation: rotationTowards(cx, cy, e.clientX, e.clientY, e.shiftKey) });
    }
  }

  function start(e: React.PointerEvent, block: TextBlock, kind: Drag['kind']) {
    e.stopPropagation();
    e.preventDefault();
    select(block.id);
    ref.current?.setPointerCapture(e.pointerId);
    drag.current = kind === 'move' ? { kind, id: block.id, startX: e.clientX, startY: e.clientY, x: block.x, y: block.y } : { kind, id: block.id };
  }

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none"
      onPointerDown={() => select(null)}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {blocks.map((block) => {
        const px = block.size * height;
        const selected = block.id === selectedId;
        return (
          <div
            key={block.id}
            className="absolute"
            style={{ left: `${block.x * 100}%`, top: `${block.y * 100}%`, transform: `translate(-50%, -50%) rotate(${block.rotation}deg)` }}
          >
            <div
              onPointerDown={(e) => start(e, block, 'move')}
              onDoubleClick={() => document.getElementById(TEXT_INPUT_ID)?.focus()}
              className={cn('cursor-move text-center whitespace-pre select-none', selected && 'outline-2 outline-offset-2 outline-primary outline-dashed')}
              style={{
                fontFamily: `"${block.font}", sans-serif`,
                fontWeight: block.bold ? 'bold' : 'normal',
                fontSize: px,
                lineHeight: LINE_HEIGHT,
                padding: `${PADDING_Y * px}px ${PADDING_X * px}px`,
                borderRadius: RADIUS * px,
                color: block.color,
                background: block.background ?? 'transparent',
              }}
            >
              {block.text || ' '}
            </div>
            {selected && (
              <>
                <span className="pointer-events-none absolute bottom-full left-1/2 h-4 w-px -translate-x-1/2 bg-primary" />
                <button
                  type="button"
                  onPointerDown={(e) => start(e, block, 'rotate')}
                  className="absolute bottom-full left-1/2 mb-4 flex size-6 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-primary bg-background text-primary shadow"
                  aria-label="Rotate"
                >
                  <RotateCw className="size-3" />
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ColorSwatch({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="block size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-full cursor-pointer opacity-0" aria-label={label} />
        </label>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Asks before making a text version's text final (it can't be edited afterwards). */
export function MergeTextButton({ onMerge, disabled }: { onMerge: () => void; disabled?: boolean }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Merge /> <span className="hidden md:inline">{t('text.merge')}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('text.merge')}</AlertDialogTitle>
          <AlertDialogDescription>{t('text.mergeConfirm')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onMerge}>{t('text.mergeAction')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Add blocks, style the selected one, then apply them. On a text version the
 * blocks are its saved ones, and applying updates it in place.
 */
export function TextToolbar() {
  const t = useT();
  const { blocks, selectedId, add, update, remove } = useText();
  const brand = useWorkspace((s) => s.brand);
  const { applyText, mergeText, setTextMode } = useWorkspace();
  const gen = useWorkspace(selectedGeneration);
  const editing = !!gen?.textLayer;
  const [applying, setApplying] = useState(false);
  const block = blocks.find((b) => b.id === selectedId);
  const patch = (p: Partial<TextBlock>) => block && update(block.id, p);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-2 py-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={() => add(brand.font || 'Anton', brand.colors[0] ? { background: brand.colors[0] } : {})}
      >
        <Plus /> {t('text.add')}
      </Button>

      {block && (
        <>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Textarea
            id={TEXT_INPUT_ID}
            value={block.text}
            onChange={(e) => patch({ text: e.target.value })}
            rows={1}
            placeholder={t('text.placeholder')}
            aria-label={t('text.content')}
            className="max-h-20 min-h-8 w-44 resize-none py-1.5 text-sm"
          />
          <FontPicker compact value={block.font} onChange={(font) => font && patch({ font })} className="w-40" />
          <Slider
            className="w-24"
            min={0.03}
            max={0.35}
            step={0.005}
            value={[block.size]}
            onValueChange={([size]) => patch({ size })}
            aria-label={t('text.size')}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle size="sm" pressed={block.bold} onPressedChange={(bold) => patch({ bold })} aria-label={t('text.bold')}>
                <Bold />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>{t('text.bold')}</TooltipContent>
          </Tooltip>
          <ColorSwatch value={block.color} onChange={(color) => patch({ color })} label={t('text.color')} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={!!block.background}
                onPressedChange={(on) => patch({ background: on ? '#111111' : null })}
                aria-label={t('text.background')}
              >
                <PaintBucket />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>{t('text.background')}</TooltipContent>
          </Tooltip>
          {block.background && <ColorSwatch value={block.background} onChange={(background) => patch({ background })} label={t('text.backgroundColor')} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="tabular w-14 px-1" onClick={() => patch({ rotation: 0 })} aria-label={t('text.resetRotation')}>
                <RotateCw /> {block.rotation}°
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('text.resetRotation')}</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon-sm" onClick={() => remove(block.id)} aria-label={t('common.delete')}>
            <Trash2 />
          </Button>
        </>
      )}

      <div className="ml-auto flex flex-wrap justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setTextMode(false)}>
          <X /> {t('common.cancel')}
        </Button>
        {editing && (
          <MergeTextButton
            disabled={applying}
            onMerge={async () => {
              setApplying(true);
              // Merge what is on screen, including unapplied changes.
              const applied = await applyText(blocks);
              if (applied) await mergeText(applied.id);
              setApplying(false);
            }}
          />
        )}
        <Button
          size="sm"
          disabled={applying || (!editing && !blocks.some((b) => b.text.trim()))}
          onClick={async () => {
            setApplying(true);
            await applyText(blocks);
            setApplying(false);
          }}
        >
          {applying ? <Loader2 className="animate-spin" /> : <Check />} {t('text.apply')}
        </Button>
      </div>
    </div>
  );
}
