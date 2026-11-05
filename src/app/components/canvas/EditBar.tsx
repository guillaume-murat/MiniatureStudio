import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUp, ChevronUp, GripVertical, History, Lightbulb, Loader2, SquareDashedMousePointer, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import { Textarea } from '../ui/textarea';
import { Toggle } from '../ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { EditPromptEye } from './EditPromptEye';
import { RevertDialog } from '../iterate/VersionDialogs';
import { runningJobs } from './BlockingJob';
import { COMMANDS, isAvailable } from '../../commands';
import { usePinch } from '../../hooks/use-pinch';
import { useSettings } from '../../stores/settings';
import { useWorkspace, viewingOlder } from '../../stores/workspace';
import { clampBarOffset, type BarOffset, type Size } from '../../lib/editBar';
import { historyOf } from '../../lib/versions';
import { explainError } from '../../lib/errors';
import { useT, type TKey } from '../../i18n';
import type { Generation } from '../../lib/types';

const SUGGESTIONS = ['emotion', 'contrast', 'background', 'zoom', 'text', 'noText'] as const;

const TOOLS = COMMANDS.filter((c) => c.group === 'tool');

/**
 * It floats below the image, with room kept for it by the canvas, and its
 * handle moves it around `area`, the space it floats in.
 */
export function EditBarShell({ area, children }: { area: Size; children: ReactNode }) {
  const t = useT();
  const saved = useSettings((s) => s.editBarOffset);
  const set = useSettings((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState({ width: 0, height: 0 });
  const [moved, setMoved] = useState<BarOffset | null>(null);
  const grab = useRef<{ pointerX: number; pointerY: number; from: BarOffset; to?: BarOffset } | null>(null);
  const offset = clampBarOffset(moved ?? saved, area, bar);

  // Before painting, so that a bar at its limit never shows past it.
  useLayoutEffect(() => {
    const el = ref.current!;
    // Its whole box, padding included, unlike useElementSize.
    const measure = () => setBar({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A pinch over the bar does nothing, rather than zooming the whole page.
  usePinch(ref, { onZoom: () => {} });

  const drop = () => {
    const to = grab.current?.to;
    grab.current = null;
    if (to) set({ editBarOffset: to });
    setMoved(null);
  };

  return (
    <div
      ref={ref}
      style={{ '--bar-x': `${offset.x}px`, '--bar-y': `${offset.y}px` } as CSSProperties}
      className="@container absolute bottom-2 left-1/2 z-10 w-[min(42rem,calc(100%-1.5rem))] translate-x-[calc(var(--bar-x)-50%)] translate-y-(--bar-y) rounded-xl border-2 border-ink bg-background p-2 pl-5 shadow-pop-lg"
    >
      <button
        type="button"
        aria-label={t('iterate.moveBar')}
        title={t('iterate.moveBar')}
        className="absolute inset-y-0 left-0 flex w-5 cursor-grab touch-none items-center justify-center rounded-l-xl text-muted-foreground hover:bg-accent active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          grab.current = { pointerX: e.clientX, pointerY: e.clientY, from: offset };
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (!g) return;
          // The button came up where we couldn't see it: the bar must not follow the pointer.
          if (e.buttons === 0) return drop();
          g.to = clampBarOffset({ x: g.from.x + e.clientX - g.pointerX, y: g.from.y + e.clientY - g.pointerY }, area, bar);
          setMoved(g.to);
        }}
        onPointerUp={drop}
        onPointerCancel={drop}
        onLostPointerCapture={drop}
      >
        <GripVertical className="size-3.5" />
      </button>
      {children}
    </div>
  );
}

/** An older version is only looked at: the way on from it, in place of what edits it. */
function OlderVersionNotice({ gen }: { gen: Generation }) {
  const t = useT();
  const { generations, jobs, select } = useWorkspace();
  const [reverting, setReverting] = useState(false);
  const running = runningJobs(jobs).length > 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-auto flex items-center gap-1.5 font-medium">
        <History className="size-3.5 text-muted-foreground" /> {t('versions.older')}
      </span>
      <Button variant="outline" size="xs" disabled={running} onClick={() => select(historyOf(generations, gen.id).at(-1)!.id)}>
        {t('versions.showLatest')}
      </Button>
      <Button size="xs" disabled={running} onClick={() => setReverting(true)}>
        <Undo2 /> {t('versions.revert')}
      </Button>
      <RevertDialog gen={gen} open={reverting} onOpenChange={setReverting} />
    </div>
  );
}

/** The image tools, with their names as long as the bar has room for them. */
function ToolButtons({ locked }: { locked: boolean }) {
  const t = useT();
  const ws = useWorkspace();
  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map((c) => (
        <Tooltip key={c.id}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={c.active?.(ws) ?? false}
              disabled={locked || !isAvailable(c, ws)}
              onPressedChange={() => c.run(useWorkspace.getState())}
              aria-label={t(c.label(ws))}
              // Not data-state: the tooltip's trigger replaces the toggle's.
              className="gap-1.5 px-2 text-xs aria-pressed:bg-primary/15 aria-pressed:text-primary"
            >
              <c.icon /> <span className="hidden @min-[34rem]:inline">{t(c.shortLabel!)}</span>
            </Toggle>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            {t(c.label(ws))} <Kbd className="[@media(pointer:coarse)]:hidden">{c.key.toUpperCase()}</Kbd>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/**
 * The edit bar under the image: the instruction, its suggestions, the tools, the prompt it would send.
 * The instruction is held by the canvas: the bar goes away with other views and tools.
 */
export function EditBar({
  gen,
  instruction,
  onInstruction,
  maskControls,
}: {
  gen: Generation;
  instruction: string;
  onInstruction: (text: string) => void;
  /** The area tool's controls, in place of the tools while it is on. */
  maskControls?: ReactNode;
}) {
  const t = useT();
  const { edit, tool, setTool, hasMask, jobs } = useWorkspace();
  const field = useRef<HTMLTextAreaElement>(null);
  const refocusField = useRef(false);
  const editing = jobs.some((j) => j.status === 'running' && j.parentId === gen.id);
  const region = tool === 'mask' && hasMask;
  // The overlay only stops the pointer: Enter and Tab would still reach the bar during a call.
  const running = runningJobs(jobs).length > 0;
  const older = useWorkspace(viewingOlder);
  const locked = running || older;

  const submit = async () => {
    if (locked || !instruction.trim()) return;
    // Emptied at once, so that a second Enter can't pay for it twice; back if nothing came of it.
    onInstruction('');
    try {
      const outcomes = await edit(instruction);
      if (outcomes.some((o) => o.error !== undefined)) onInstruction(instruction);
    } catch (error) {
      onInstruction(instruction);
      const info = explainError(error);
      toast.error(t(info.key), { description: info.message });
    }
  };

  return (
    <div className="space-y-1.5">
      {older && <OlderVersionNotice gen={gen} />}
      <Textarea
        ref={field}
        rows={1}
        readOnly={locked}
        value={instruction}
        onChange={(e) => onInstruction(e.target.value)}
        onKeyDown={(e) => {
          // The global Esc ignores a field being typed in, where the area tool is mostly used.
          if (e.key === 'Escape' && !running) setTool(null);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
            e.preventDefault();
            e.stopPropagation();
            submit();
          }
        }}
        placeholder={region ? t('iterate.regionPlaceholder') : t('iterate.editPlaceholder')}
        aria-label={t('iterate.instruction')}
        className="max-h-32 min-h-9 resize-none"
      />
      {maskControls}
      <div className="flex items-center gap-1">
        {!maskControls && <ToolButtons locked={locked} />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={locked} aria-label={t('iterate.suggestions')}>
              <Lightbulb /> <span className="hidden @md:inline">{t('iterate.suggestions')}</span> <ChevronUp />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            onCloseAutoFocus={(e) => {
              if (!refocusField.current) return;
              // Back in the field rather than on the menu's button, to complete or send.
              refocusField.current = false;
              e.preventDefault();
              field.current?.focus();
            }}
          >
            {SUGGESTIONS.map((key) => {
              const text = t(`iterate.quickEdits.${key}` as TKey);
              return (
                <DropdownMenuItem
                  key={key}
                  className="italic"
                  onSelect={() => {
                    refocusField.current = true;
                    onInstruction(text);
                  }}
                >
                  {text}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* In the row, so painting doesn't change the bar's height. */}
        {region && (
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-primary" title={t('iterate.regionActive')}>
            <SquareDashedMousePointer className="size-3.5 shrink-0" /> <span className="truncate">{t('iterate.regionActive')}</span>
          </p>
        )}
        <span className="ml-auto flex">
          <EditPromptEye instruction={instruction} />
        </span>
        <Button size="icon-lg" onClick={submit} disabled={locked || !instruction.trim()} aria-label={t('iterate.send')}>
          {editing ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </div>
    </div>
  );
}
