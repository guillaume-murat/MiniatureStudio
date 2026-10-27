import { useEffect, useRef, useState } from 'react';
import { ArrowBigRight, Bold, Check, CircleDashed, Layers, Loader2, Merge, MoveHorizontal, MoveRight, PaintBucket, Plus, ArrowUpRight, RotateCw, Square, Trash2, X } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { FontPicker } from './FontPicker';
import { useText } from '../../stores/text';
import { selectedGeneration, useWorkspace } from '../../stores/workspace';
import { loadGoogleFont } from '../../lib/fonts';
import {
  arrowGeometry,
  bendThrough,
  clamp01,
  dashPattern,
  isArrow,
  isVisible,
  LINE_HEIGHT,
  PADDING_X,
  PADDING_Y,
  RADIUS,
  rotationTowards,
  type ArrowBlock,
  type ArrowHead,
  type LayerBlock,
  type TextBlock,
} from '../../lib/textBlocks';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

const TEXT_INPUT_ID = 'text-block-input';

type Drag =
  | { kind: 'move'; id: string; startX: number; startY: number; x: number; y: number }
  | { kind: 'rotate'; id: string }
  | { kind: 'arrow-move'; id: string; startX: number; startY: number; from: ArrowBlock }
  | { kind: 'arrow-start' | 'arrow-tip' | 'arrow-bend'; id: string };

/** The arrow as SVG, drawn like the canvas render (lib/textBlocks.ts): shadow, border, then colour. */
function ArrowShape({ block, width, height, selected, onGrab }: { block: ArrowBlock; width: number; height: number; selected: boolean; onGrab: (e: React.PointerEvent) => void }) {
  const g = arrowGeometry(block, width, height);
  const dash = block.dashed ? dashPattern(g.stroke).join(' ') : undefined;
  const layer = (color: string, extra: number) => (
    <g stroke={color} fill={color} strokeLinecap="round" strokeLinejoin="round">
      <path d={g.shaft} fill="none" strokeWidth={g.stroke + extra} strokeDasharray={dash} />
      {g.heads.map((d) => (block.head === 'open' ? <path key={d} d={d} fill="none" strokeWidth={g.stroke + extra} /> : <path key={d} d={d} strokeWidth={extra} />))}
    </g>
  );
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <g style={block.shadow ? { filter: `drop-shadow(0 ${g.stroke * 0.4}px ${g.stroke * 0.75}px rgba(0, 0, 0, 0.55))` } : undefined}>
        {block.outline && layer(block.outline, 2 * g.border)}
        {layer(block.color, 0)}
      </g>
      {selected && <path d={g.shaft} fill="none" stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="4 3" />}
      {/* Wider invisible hit area along the line and the heads */}
      <g className="pointer-events-auto cursor-move" onPointerDown={onGrab} stroke="transparent" fill="transparent" strokeWidth={Math.max(18, g.stroke + 2 * g.border + 8)} strokeLinecap="round">
        <path d={g.shaft} fill="none" />
        {g.heads.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

function Handle({ x, y, onGrab, label, round = true }: { x: number; y: number; onGrab: (e: React.PointerEvent) => void; label: string; round?: boolean }) {
  return (
    <button
      type="button"
      onPointerDown={onGrab}
      aria-label={label}
      className={cn('absolute size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab border-2 border-primary bg-background shadow', round ? 'rounded-full' : 'rotate-45 rounded-sm')}
      style={{ left: x, top: y }}
    />
  );
}

/**
 * The blocks over the image. Texts: drag to move, drag the round handle to
 * rotate (Shift snaps to 15°). Arrows: drag the line to move, the ends to
 * place them, the diamond in the middle to bend it.
 */
export function TextOverlay({ width, height }: { width: number; height: number }) {
  const t = useT();
  const { blocks, selectedId, select, update } = useText();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  // Make every family on screen available (bundled files for the listed ones).
  useEffect(() => {
    for (const font of new Set(blocks.flatMap((b) => (isArrow(b) ? [] : [b.font])))) loadGoogleFont(font).catch(() => {});
  }, [blocks]);

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const rect = ref.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const block = blocks.find((b) => b.id === d.id);
    if (!block) return;
    const p = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    if (d.kind === 'move') {
      update(d.id, {
        x: clamp01(d.x + (e.clientX - d.startX) / rect.width),
        y: clamp01(d.y + (e.clientY - d.startY) / rect.height),
      });
    } else if (d.kind === 'rotate' && !isArrow(block)) {
      const cx = rect.left + block.x * rect.width;
      const cy = rect.top + block.y * rect.height;
      update(d.id, { rotation: rotationTowards(cx, cy, e.clientX, e.clientY, e.shiftKey) });
    } else if (d.kind === 'arrow-move') {
      const dx = (e.clientX - d.startX) / rect.width;
      const dy = (e.clientY - d.startY) / rect.height;
      update(d.id, { x1: d.from.x1 + dx, y1: d.from.y1 + dy, x2: d.from.x2 + dx, y2: d.from.y2 + dy });
    } else if (d.kind === 'arrow-start') {
      update(d.id, { x1: clamp01(p.x), y1: clamp01(p.y) });
    } else if (d.kind === 'arrow-tip') {
      update(d.id, { x2: clamp01(p.x), y2: clamp01(p.y) });
    } else if (d.kind === 'arrow-bend' && isArrow(block)) {
      update(d.id, { bend: bendThrough(block, { x: p.x * width, y: p.y * height }, width, height) });
    }
  }

  function start(e: React.PointerEvent, block: LayerBlock, kind: Drag['kind']) {
    e.stopPropagation();
    e.preventDefault();
    select(block.id);
    ref.current?.setPointerCapture(e.pointerId);
    if (isArrow(block)) {
      drag.current = kind === 'arrow-move' ? { kind, id: block.id, startX: e.clientX, startY: e.clientY, from: block } : { kind: kind as 'arrow-start', id: block.id };
    } else {
      drag.current = kind === 'move' ? { kind, id: block.id, startX: e.clientX, startY: e.clientY, x: block.x, y: block.y } : { kind: 'rotate', id: block.id };
    }
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
        const selected = block.id === selectedId;
        if (isArrow(block)) {
          const g = arrowGeometry(block, width, height);
          return (
            <div key={block.id} className="pointer-events-none absolute inset-0">
              <ArrowShape block={block} width={width} height={height} selected={selected} onGrab={(e) => start(e, block, 'arrow-move')} />
              {selected && (
                <div className="pointer-events-auto">
                  <Handle x={g.start.x} y={g.start.y} onGrab={(e) => start(e, block, 'arrow-start')} label={t('arrow.start')} />
                  <Handle x={g.tip.x} y={g.tip.y} onGrab={(e) => start(e, block, 'arrow-tip')} label={t('arrow.tip')} />
                  <Handle x={g.middle.x} y={g.middle.y} onGrab={(e) => start(e, block, 'arrow-bend')} label={t('arrow.bend')} round={false} />
                </div>
              )}
            </div>
          );
        }
        const px = block.size * height;
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
        <Button variant="outline" size="sm" disabled={disabled} title={t('text.merge')} aria-label={t('text.merge')}>
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

function IconToggle({ pressed, onPressedChange, label, children }: { pressed: boolean; onPressedChange: (on: boolean) => void; label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle size="sm" pressed={pressed} onPressedChange={onPressedChange} aria-label={label}>
          {children}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const HEADS: Array<{ value: ArrowHead; icon: typeof MoveRight }> = [
  { value: 'filled', icon: ArrowBigRight },
  { value: 'open', icon: MoveRight },
  { value: 'double', icon: MoveHorizontal },
];

/** Style controls for the selected arrow. */
function ArrowControls({ block }: { block: ArrowBlock }) {
  const t = useT();
  const update = useText((s) => s.update);
  const patch = (p: Partial<Omit<ArrowBlock, 'id' | 'kind'>>) => update(block.id, p);
  return (
    <>
      <ToggleGroup type="single" size="sm" variant="outline" value={block.head} onValueChange={(v) => v && patch({ head: v as ArrowHead })}>
        {HEADS.map(({ value, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem value={value} aria-label={t(`arrow.heads.${value}`)}>
                <Icon />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{t(`arrow.heads.${value}`)}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
      <span className="text-xs text-muted-foreground">{t('arrow.width')}</span>
      <Slider className="w-20" min={0.006} max={0.06} step={0.001} value={[block.width]} onValueChange={([width]) => patch({ width })} aria-label={t('arrow.width')} />
      <span className="text-xs text-muted-foreground">{t('arrow.bend')}</span>
      <Slider className="w-20" min={-1} max={1} step={0.01} value={[block.bend]} onValueChange={([bend]) => patch({ bend })} aria-label={t('arrow.bend')} />
      <ColorSwatch value={block.color} onChange={(color) => patch({ color })} label={t('arrow.color')} />
      <IconToggle pressed={!!block.outline} onPressedChange={(on) => patch({ outline: on ? '#ffffff' : null })} label={t('arrow.outline')}>
        <Square />
      </IconToggle>
      {block.outline && <ColorSwatch value={block.outline} onChange={(outline) => patch({ outline })} label={t('arrow.outlineColor')} />}
      <IconToggle pressed={block.dashed} onPressedChange={(dashed) => patch({ dashed })} label={t('arrow.dashed')}>
        <CircleDashed />
      </IconToggle>
      <IconToggle pressed={block.shadow} onPressedChange={(shadow) => patch({ shadow })} label={t('arrow.shadow')}>
        <Layers />
      </IconToggle>
    </>
  );
}

/**
 * Add text blocks and arrows, style the selected one, then apply them. On a
 * text version the blocks are its saved ones, and applying updates it in place.
 */
export function TextToolbar() {
  const t = useT();
  const { blocks, selectedId, add, addArrow, update, remove } = useText();
  const brand = useWorkspace((s) => s.brand);
  const { applyText, mergeText, setTextMode } = useWorkspace();
  const gen = useWorkspace(selectedGeneration);
  const editing = !!gen?.textLayer;
  const [applying, setApplying] = useState(false);
  const selected = blocks.find((b) => b.id === selectedId);
  const block = selected && !isArrow(selected) ? selected : undefined;
  const arrow = selected && isArrow(selected) ? selected : undefined;
  const patch = (p: Partial<Omit<TextBlock, 'id' | 'kind'>>) => block && update(block.id, p);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-2 py-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={() => add('Anton', brand.colors[0] ? { background: brand.colors[0] } : {})}
      >
        <Plus /> {t('text.add')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => addArrow()}>
        <ArrowUpRight /> {t('arrow.add')}
      </Button>

      {arrow && (
        <>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <ArrowControls block={arrow} />
          <Button variant="ghost" size="icon-sm" onClick={() => remove(arrow.id)} aria-label={t('common.delete')}>
            <Trash2 />
          </Button>
        </>
      )}

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
          <FontPicker value={block.font} onChange={(font) => font && patch({ font })} className="w-40" />
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
          disabled={applying || (!editing && !blocks.some(isVisible))}
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
