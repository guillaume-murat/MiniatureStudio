import { useEffect, useState, type ReactNode } from 'react';
import { RemoveThumbnailDialog } from '../iterate/VersionDialogs';
import {
  Bandage,
  ScanFace,
  Check,
  Blend,
  Brush,
  Copy,
  Download,
  Eraser,
  ImageIcon,
  ImagePlus,
  Library,
  MoreHorizontal,
  RotateCcw,
  ScanLine,
  Star,
  Trash2,
  X,
  SquarePlay,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '../ui/button';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Kbd } from '../ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ImageMenu } from '../ImageMenu';
import { SafeZones } from './SafeZones';
import { MaskLayer, type MaskTool } from './MaskLayer';
import { EditBar, EditBarShell } from './EditBar';
import { ChannelPreview } from './ChannelPreview';
import { TextOverlay, TextToolbar } from './TextLayer';
import { ReframeToolbar, ReframeView } from './ReframeLayer';
import { runningJobs } from './BlockingJob';
import { FeedPreview } from './FeedPreview';
import { CompareView } from './CompareView';
import { SketchView } from './SketchView';
import { ModelNote } from '../ModelNote';
import { MOD } from '../TopBar';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { fit, useElementSize } from '../../hooks/use-element-size';
import { usePinch } from '../../hooks/use-pinch';
import { clampPan, NO_ZOOM, zoomAt, type ViewZoom } from '../../lib/zoom';
import { isLayerTool, selectedGeneration, useWorkspace, viewingOlder, type Job } from '../../stores/workspace';
import { useReframe } from '../../stores/reframe';
import { downloadForYouTube } from '../../lib/exporting';
import { downloadBlob, extensionFor, FULL_HD_SIZE } from '../../lib/images';
import { useT } from '../../i18n';
import type { Generation } from '../../lib/types';
import { cn } from '../../lib/utils';

function IconTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A call that failed (running ones are shown by BlockingJobOverlay). */
function FailedJob({ job }: { job: Job }) {
  const t = useT();
  const dismissJob = useWorkspace((s) => s.dismissJob);
  const showError = useWorkspace((s) => s.showError);
  return (
    <div className="flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-card py-2 pr-2 pl-3 text-xs text-destructive shadow-pop-sm">
      <AlertCircle className="size-3.5" />
      <span className="max-w-64 truncate">{job.error || t('canvas.failed')}</span>
      {job.report && (
        <Button variant="ghost" size="xs" onClick={() => showError(job.report!)}>
          {t('errors.details')}
        </Button>
      )}
      <Button variant="ghost" size="icon-xs" onClick={() => dismissJob(job.id)} aria-label={t('common.close')}>
        <X />
      </Button>
    </div>
  );
}

function EmptyState({ running }: { running: number }) {
  const t = useT();
  if (running) {
    return (
      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 p-6">
        {Array.from({ length: running }).map((_, i) => (
          <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border bg-card">
        <ImageIcon className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium">{t('canvas.empty')}</p>
      <p className="text-sm text-muted-foreground">
        {t('canvas.emptyHint', { shortcut: `${MOD} ↵` })}
      </p>
    </div>
  );
}

/**
 * The image, centred above the edit bar (`reserve`, its room at the bottom, in px). The view
 * itself runs to the bottom of the area: zoomed in, the image fills it under the bar too.
 */
function ImageView({ gen, tool, brushSize, reserve, cornerBottom }: { gen: Generation; tool: MaskTool; brushSize: number; reserve: number; cornerBottom: number }) {
  const { safeZones, tool: active, setTool } = useWorkspace();
  const older = useWorkspace(viewingOlder);
  const busy = useWorkspace((s) => runningJobs(s.jobs).length > 0);
  // A press on the image with no tool opens the area tool and paints from there.
  const [strokeStart, setStrokeStart] = useState<{ clientX: number; clientY: number; pointerId: number } | null>(null);
  const paintable = !active && !older && !busy;
  // Only for the press that opened it: the M key or the edit bar open it without a stroke.
  useEffect(() => {
    if (active !== 'mask') setStrokeStart(null);
  }, [active]);
  const url = useBlobUrl(gen.blob);
  const [ref, box] = useElementSize<HTMLDivElement>();
  const size = fit(gen.width / gen.height, { width: box.width - 48, height: box.height - 48 - reserve });
  const [zoom, setZoom] = useState<ViewZoom>(NO_ZOOM);
  const t = useT();

  useEffect(() => setZoom(NO_ZOOM), [gen.id]);

  // Trackpad pinch zooms around the cursor; two-finger scroll pans once zoomed in.
  usePinch(ref, {
    onZoom: (factor, clientX, clientY) => {
      const rect = ref.current!.getBoundingClientRect();
      // From the image's centre, above the room kept for the edit bar.
      const d = { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + (rect.height - reserve) / 2) };
      setZoom((v) => zoomAt(v, factor, d, size));
    },
    onPan: (dx, dy) => {
      if (zoom.z <= 1) return false;
      setZoom((v) => clampPan({ z: v.z, x: v.x - dx, y: v.y - dy }, size.width, size.height));
      return true;
    },
  });

  return (
    <div ref={ref} className="relative flex size-full items-center justify-center overflow-hidden" style={{ paddingBottom: reserve }}>
      {/* Bottom left of the area, beside the edit bar; the image actions take the bottom right. */}
      {zoom.z !== 1 && (
        <Button variant="secondary" size="xs" className="tabular absolute left-3 z-20" style={{ bottom: cornerBottom }} onClick={() => setZoom(NO_ZOOM)}>
          {Math.round(zoom.z * 100)} % · {t('canvas.resetZoom')}
        </Button>
      )}
      {size.width > 0 && (
        <ImageMenu gen={gen} disabled={!!active}>
        <div
          className={cn('relative overflow-hidden rounded-lg ring-1 ring-border', paintable && 'cursor-brush touch-none')}
          style={{ ...size, transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})` }}
          onPointerDown={(e) => {
            // The main button only: a right click opens the image's menu.
            if (!paintable || e.button !== 0) return;
            setStrokeStart({ clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId });
            setTool('mask');
          }}
        >
          <img src={url} alt={gen.prompt} className="size-full select-none" draggable={false} />
          {safeZones && <SafeZones aspectRatio={gen.params.aspectRatio} />}
          {active === 'mask' && <MaskLayer width={gen.width} height={gen.height} tool={tool} brushSize={brushSize} start={strokeStart} />}
          {isLayerTool(active) && <TextOverlay width={size.width} height={size.height} kind={active} />}
        </div>
        </ImageMenu>
      )}
    </div>
  );
}

const coversFullHd = (gen: Generation) => gen.width >= FULL_HD_SIZE.width && gen.height >= FULL_HD_SIZE.height;

/**
 * 1920×1080 export. Smaller images are first upscaled by the model (a new
 * version, so it is visible and paid once), then exported from that version.
 */
async function exportFullHd(gen: Generation, t: ReturnType<typeof useT>) {
  if (coversFullHd(gen)) return downloadForYouTube(gen, FULL_HD_SIZE);
  toast.info(t('export.upscaleStarted'));
  const outcome = await useWorkspace.getState().upscale(gen.id);
  if (outcome?.value) return downloadForYouTube(outcome.value, FULL_HD_SIZE, gen);
  // No key (settings were opened) or the user cancelled: nothing to export.
  if (!outcome?.error || outcome.error === t('agent.canceled')) return;
  toast.warning(t('export.upscaleFailed'));
  return downloadForYouTube(gen, FULL_HD_SIZE);
}

function ImageActions({ gen }: { gen: Generation }) {
  const t = useT();
  const [removing, setRemoving] = useState(false);
  const { toggleFavorite, addRef, saveToLibrary, reuse, view, safeZones, setSafeZones } = useWorkspace();
  // Upscaling makes a version: not from an older one.
  const fullHdBlocked = useWorkspace(viewingOlder) && !coversFullHd(gen);
  return (
    <>
      <IconTip label={gen.favorite ? t('canvas.unfavorite') : t('canvas.favorite')}>
        <Button variant="ghost" size="icon-sm" onClick={() => toggleFavorite(gen.id)} aria-pressed={!!gen.favorite}>
          <Star className={cn(gen.favorite && 'fill-highlight text-highlight')} />
        </Button>
      </IconTip>
      <IconTip label={t('canvas.exportYouTube')}>
        <Button variant="ghost" size="icon-sm" onClick={() => downloadForYouTube(gen)}>
          <Download />
        </Button>
      </IconTip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {view === 'image' && (
            <>
              <DropdownMenuItem onSelect={() => setSafeZones(!safeZones)}>
                <ScanLine /> {t('canvas.safeZones')}
                {safeZones && <Check className="text-primary" />}
                <DropdownMenuShortcut>Z</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => downloadBlob(gen.blob, `miniature-studio-${gen.id.slice(2, 10)}.${extensionFor(gen.blob)}`)}>
            <Download /> {t('canvas.download')} ({gen.width}×{gen.height})
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadForYouTube(gen)}>
            <SquarePlay /> {t('canvas.exportYouTube')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={fullHdBlocked} onSelect={() => exportFullHd(gen, t)}>
            <SquarePlay />
            <span>
              {t('canvas.exportFullHd')}
              {fullHdBlocked && <span className="block text-xs">{t('versions.olderNoUpscale')}</span>}
              {!fullHdBlocked && !coversFullHd(gen) && <ModelNote call="upscale" />}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => addRef(gen.blob, 'history')}>
            <ImagePlus /> {t('canvas.useAsRef')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => saveToLibrary(gen.blob)}>
            <Library /> {t('canvas.saveToLibrary')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reuse(gen)}>
            <RotateCcw /> {t('canvas.reuse')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              await navigator.clipboard.writeText(gen.fullPrompt);
              toast.success(t('common.copied'));
            }}
          >
            <Copy /> {t('canvas.copyPrompt')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(true)}>
            <Trash2 /> {t('canvas.deleteImage')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveThumbnailDialog gen={gen} open={removing} onOpenChange={setRemoving} />
    </>
  );
}

/** An area tool action: its tip says to paint first while nothing is painted (a disabled button gets no hover). */
function AreaAction({ hint, ready, children }: { hint: ReactNode; ready: boolean; children: ReactNode }) {
  const t = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={ready ? -1 : 0}>{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{ready ? hint : t('canvas.paintFirst')}</TooltipContent>
    </Tooltip>
  );
}

/** « Corriger visage (avec IA) »: a list of the people selected for the project; choosing one starts the fix. */
function FaceFixSelect({ disabled }: { disabled: boolean }) {
  const t = useT();
  const personas = useWorkspace((s) => s.personas);
  const personaIds = useWorkspace((s) => s.personaIds);
  const hasMask = useWorkspace((s) => s.hasMask);
  const fixFace = useWorkspace((s) => s.fixFace);
  const people = personaIds.flatMap((id) => personas.filter((p) => p.id === id));
  const hint = !people.length ? t('face.needPerson') : hasMask ? t('face.hint') : t('canvas.paintFirst');
  // The tip would cover the list, which opens above too.
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open ? false : undefined}>
      <TooltipTrigger asChild>
        <span tabIndex={!people.length || !hasMask ? 0 : -1}>
          {/* Always empty: a choice starts the fix, nothing stays selected. */}
          <Select value="" open={open} onOpenChange={setOpen} onValueChange={(id) => void fixFace(id)} disabled={disabled || !hasMask || !people.length}>
            {/* Raised like the buttons beside it: it starts an action, it is not a field. */}
            <SelectTrigger
              size="sm"
              className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), "data-[size=sm]:h-6 data-[placeholder]:text-foreground [&_svg:not([class*='text-'])]:text-foreground")}
              aria-label={t('face.button')}
            >
              <ScanFace />
              <SelectValue placeholder={t('face.button')} />
            </SelectTrigger>
            <SelectContent position="popper" side="top" align="end">
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {hint}
        {hasMask && people.length > 0 && <ModelNote call="face" className="mt-1 text-background/70" />}
      </TooltipContent>
    </Tooltip>
  );
}

export function CanvasArea() {
  const t = useT();
  const ws = useWorkspace();
  const reframeTarget = useReframe((s) => s.target);
  const reframeZone = useReframe((s) => s.zone);
  const gen = useWorkspace(selectedGeneration);
  const [maskTool, setMaskTool] = useState<MaskTool>('brush');
  const [brushSize, setBrushSize] = useState(0.05);
  const [instruction, setInstruction] = useState('');
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const running = ws.jobs.filter((j) => j.status === 'running' && j.kind === 'generate').length;
  // Blurred while Nano Banana works (BlockingJobOverlay locks the studio); failed calls stay readable.
  const busy = runningJobs(ws.jobs).length > 0;
  const failed = ws.jobs.filter((j) => j.status === 'failed');
  const onImage = !!gen && ws.view === 'image';
  // Room kept under the image for the edit bar: more for the area, text and arrow tools and an older version.
  const barRoom = ws.tool === 'mask' ? 152 : isLayerTool(ws.tool) || viewingOlder(ws) ? 144 : 112;
  // The zoom and the image actions sit in the bottom corners, beside the edit bar (up to 42rem wide),
  // or just above it when the area is too narrow for both.
  const cornerBottom = area.width >= 960 ? 12 : barRoom + 8;
  // Replaces the tools in the edit bar: preparing the area above the instruction, the one-click fixes under it.
  // No way back through the tools, and no Esc on a tablet: it has its own way out.
  const maskControls = ws.tool === 'mask' && {
    tools: (
      <div className="flex items-center gap-2">
        <ToggleGroup type="single" size="sm" disabled={busy} value={maskTool} onValueChange={(v) => v && setMaskTool(v as MaskTool)}>
          <ToggleGroupItem value="brush" aria-label={t('canvas.brush')}>
            <Brush />
          </ToggleGroupItem>
          <ToggleGroupItem value="eraser" aria-label={t('canvas.eraser')}>
            <Eraser />
          </ToggleGroupItem>
        </ToggleGroup>
        <Slider
          className="max-w-32 min-w-10 flex-1"
          disabled={busy}
          min={0.01}
          max={0.15}
          step={0.005}
          value={[brushSize]}
          onValueChange={([v]) => setBrushSize(v)}
          aria-label={t('canvas.brushSize')}
        />
        <Button variant="ghost" size="xs" className="ml-auto" disabled={busy} onClick={() => ws.setTool(null)}>
          <X /> {t('canvas.quitTool')}
        </Button>
      </div>
    ),
    fixes: (
      <div className="flex flex-wrap items-center gap-2">
        <AreaAction hint={t('smooth.hint')} ready={ws.hasMask}>
          <Button variant="outline" size="xs" disabled={busy || !ws.hasMask} onClick={() => ws.smooth()}>
            <Blend /> {t('smooth.button')}
          </Button>
        </AreaAction>
        <AreaAction hint={<>{t('heal.hint')}<ModelNote call="heal" className="mt-1 text-background/70" /></>} ready={ws.hasMask}>
          <Button variant="outline" size="xs" disabled={busy || !ws.hasMask} onClick={() => ws.heal()}>
            <Bandage /> {t('heal.button')}
          </Button>
        </AreaAction>
        <FaceFixSelect disabled={busy} />
      </div>
    ),
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      <div ref={areaRef} className="relative flex min-h-0 flex-1 flex-col">
        {/* Body: it keeps clear of the edit bar, floating below it. */}
        <div className={cn('relative min-h-0 flex-1 transition-[filter] duration-300', onImage && ws.tool === 'reframe' && 'mb-28', busy && 'pointer-events-none blur-md')}>
          {ws.view === 'sketch' ? (
            <SketchView />
          ) : ws.view === 'compare' ? (
            <CompareView />
          ) : ws.view === 'feed' && gen ? (
            <FeedPreview generation={gen} />
          ) : ws.view === 'channel' ? (
            <ChannelPreview />
          ) : gen && ws.tool === 'reframe' ? (
            <ReframeView gen={gen} />
          ) : gen ? (
            <ImageView gen={gen} tool={maskTool} brushSize={brushSize} reserve={barRoom} cornerBottom={cornerBottom} />
          ) : (
            <div className="flex size-full items-center justify-center">
              <EmptyState running={running} />
            </div>
          )}

          {ws.tool === 'reframe' && ws.view === 'image' && (
            <p className="pointer-events-none absolute top-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs text-background">
              {reframeTarget === 'zone' && !reframeZone ? t('reframe.zoneHint') : t('canvas.reframeHint')}
            </p>
          )}

          {isLayerTool(ws.tool) && ws.view === 'image' && (
            <p className="pointer-events-none absolute top-14 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs text-background">
              {ws.tool === 'arrow' ? t('arrow.hint') : t('canvas.textHint')}
            </p>
          )}

          {ws.tool === 'mask' && ws.view === 'image' && (
            <p className="pointer-events-none absolute top-14 left-1/2 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-3 py-1 text-xs whitespace-nowrap text-background">
              <span className="truncate">{t('canvas.maskHint')}</span>
              <Kbd className="shrink-0 [@media(pointer:coarse)]:hidden">Esc</Kbd>
            </p>
          )}

          {ws.tool === 'mask' && ws.view === 'image' && (
            <p style={{ bottom: barRoom + (cornerBottom > 12 ? 44 : 12) }} className="pointer-events-none absolute left-3 flex max-w-[calc(100%-1.5rem)] items-start gap-2 rounded-lg border bg-background/90 px-3 py-2 text-xs backdrop-blur">
              <Bandage className="mt-px size-3.5 shrink-0 text-muted-foreground" />
              {t('heal.context')}
            </p>
          )}

          {/* Over the image rather than in a toolbar row: the image gets the height. */}
          {gen && ws.view === 'image' && ws.tool !== 'reframe' && (
            <div className="absolute right-3 z-20 flex items-center gap-2 rounded-lg p-0.5" style={{ bottom: cornerBottom }}>
              <ImageActions gen={gen} />
            </div>
          )}

          {failed.length > 0 && !busy && (
            <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
              {failed.map((j) => (
                <FailedJob key={j.id} job={j} />
              ))}
            </div>
          )}
        </div>

        {/* Text, arrow and reframe don't take an instruction: their controls come instead. */}
        {onImage && (
          <EditBarShell area={area}>
            {isLayerTool(ws.tool) ? (
              <TextToolbar kind={ws.tool} />
            ) : ws.tool === 'reframe' ? (
              <ReframeToolbar />
            ) : (
              <EditBar gen={gen} instruction={instruction} onInstruction={setInstruction} maskControls={maskControls || undefined} />
            )}
          </EditBarShell>
        )}
      </div>
    </div>
  );
}
