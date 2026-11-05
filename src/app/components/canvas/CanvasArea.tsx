import { useEffect, useState } from 'react';
import { RemoveThumbnailDialog } from '../iterate/VersionDialogs';
import {
  Bandage,
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
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Kbd } from '../ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ImageMenu } from '../ImageMenu';
import { SafeZones } from './SafeZones';
import { MaskLayer, type MaskTool } from './MaskLayer';
import { ViewSwitcher } from './ViewSwitcher';
import { EditBar, EditBarShell } from './EditBar';
import { ChannelPreview } from './ChannelPreview';
import { TextOverlay, TextToolbar } from './TextLayer';
import { ReframeToolbar, ReframeView } from './ReframeLayer';
import { runningJobs } from './BlockingJob';
import { FeedPreview } from './FeedPreview';
import { CompareView } from './CompareView';
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
  return (
    <div className="flex items-center gap-2 rounded-full border border-destructive/40 bg-card/95 py-1 pr-1 pl-3 text-xs text-destructive shadow-sm backdrop-blur">
      <AlertCircle className="size-3.5" />
      <span className="max-w-64 truncate">{job.error || t('canvas.failed')}</span>
      <Button variant="ghost" size="icon-xs" className="rounded-full" onClick={() => dismissJob(job.id)} aria-label={t('common.close')}>
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

function ImageView({ gen, tool, brushSize, clearSignal }: { gen: Generation; tool: MaskTool; brushSize: number; clearSignal: number }) {
  const { safeZones, tool: active } = useWorkspace();
  const url = useBlobUrl(gen.blob);
  const [ref, box] = useElementSize<HTMLDivElement>();
  const size = fit(gen.width / gen.height, { width: box.width - 48, height: box.height - 48 });
  const [zoom, setZoom] = useState<ViewZoom>(NO_ZOOM);
  const t = useT();

  useEffect(() => setZoom(NO_ZOOM), [gen.id]);

  // Trackpad pinch zooms around the cursor; two-finger scroll pans once zoomed in.
  usePinch(ref, {
    onZoom: (factor, clientX, clientY) => {
      const rect = ref.current!.getBoundingClientRect();
      const d = { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) };
      setZoom((v) => zoomAt(v, factor, d, size));
    },
    onPan: (dx, dy) => {
      if (zoom.z <= 1) return false;
      setZoom((v) => clampPan({ z: v.z, x: v.x - dx, y: v.y - dy }, size.width, size.height));
      return true;
    },
  });

  return (
    <div ref={ref} className="relative flex size-full items-center justify-center overflow-hidden">
      {zoom.z !== 1 && (
        <Button variant="secondary" size="xs" className="tabular absolute bottom-3 left-3 z-10 shadow" onClick={() => setZoom(NO_ZOOM)}>
          {Math.round(zoom.z * 100)} % · {t('canvas.resetZoom')}
        </Button>
      )}
      {size.width > 0 && (
        <ImageMenu gen={gen} disabled={!!active}>
        <div
          className="relative overflow-hidden rounded-lg shadow-lg ring-1 ring-border"
          style={{ ...size, transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})` }}
        >
          <img src={url} alt={gen.prompt} className="size-full select-none" draggable={false} />
          {safeZones && <SafeZones aspectRatio={gen.params.aspectRatio} />}
          {active === 'mask' && <MaskLayer width={gen.width} height={gen.height} tool={tool} brushSize={brushSize} clearSignal={clearSignal} />}
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
          <Star className={cn(gen.favorite && 'fill-amber-400 text-amber-400')} />
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

export function CanvasArea() {
  const t = useT();
  const ws = useWorkspace();
  const reframeTarget = useReframe((s) => s.target);
  const reframeZone = useReframe((s) => s.zone);
  const gen = useWorkspace(selectedGeneration);
  const [maskTool, setMaskTool] = useState<MaskTool>('brush');
  const [brushSize, setBrushSize] = useState(0.05);
  const [clearSignal, setClearSignal] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const running = ws.jobs.filter((j) => j.status === 'running' && j.kind === 'generate').length;
  // Blurred while Nano Banana works (BlockingJobOverlay locks the studio); failed calls stay readable.
  const busy = runningJobs(ws.jobs).length > 0;
  const failed = ws.jobs.filter((j) => j.status === 'failed');
  const onImage = !!gen && ws.view === 'image';
  // Replaces the tools in the edit bar. No way back through them, and no Esc on a phone: it has its own way out.
  const maskControls = ws.tool === 'mask' && (
    <div className="flex flex-wrap items-center gap-1.5">
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
        aria-label={t('canvas.brush')}
      />
      <Button variant="ghost" size="xs" disabled={busy} onClick={() => setClearSignal((n) => n + 1)} aria-label={t('canvas.clearMask')}>
        <Trash2 /> <span className="hidden @min-[34rem]:inline">{t('canvas.clearMask')}</span>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="xs" className="ml-auto" disabled={busy || !ws.hasMask} onClick={() => ws.smooth()}>
            <Blend /> {t('smooth.button')}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{t('smooth.hint')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="xs" disabled={busy || !ws.hasMask} onClick={() => ws.heal()}>
            <Bandage /> {t('heal.button')}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{t('heal.hint')}</TooltipContent>
      </Tooltip>
      <Button variant="ghost" size="xs" disabled={busy} onClick={() => ws.setTool(null)} aria-label={t('common.cancel')}>
        <X /> <span className="hidden @min-[34rem]:inline">{t('common.cancel')}</span>
      </Button>
    </div>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      {/* Mobile only: on desktop the view switcher sits in the top bar. */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-background px-2 lg:hidden">
        <ViewSwitcher />
      </div>

      <div ref={areaRef} className="relative flex min-h-0 flex-1 flex-col">
        {/* Body. On desktop it keeps clear of the edit bar, floating below it. */}
        <div className={cn('relative min-h-0 flex-1 transition-[filter] duration-300', onImage && (ws.tool === 'mask' ? 'lg:mb-38' : isLayerTool(ws.tool) || viewingOlder(ws) ? 'lg:mb-36' : 'lg:mb-28'), busy && 'pointer-events-none blur-md')}>
          {ws.view === 'compare' ? (
            <CompareView />
          ) : ws.view === 'feed' && gen ? (
            <FeedPreview generation={gen} />
          ) : ws.view === 'channel' ? (
            <ChannelPreview />
          ) : gen && ws.tool === 'reframe' ? (
            <ReframeView gen={gen} />
          ) : gen ? (
            <ImageView gen={gen} tool={maskTool} brushSize={brushSize} clearSignal={clearSignal} />
          ) : (
            <div className="flex size-full items-center justify-center">
              <EmptyState running={running} />
            </div>
          )}

          {ws.tool === 'reframe' && ws.view === 'image' && (
            <p className="pointer-events-none absolute top-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-foreground px-3 py-1 text-xs text-background shadow sm:rounded-full">
              {reframeTarget === 'zone' && !reframeZone ? t('reframe.zoneHint') : t('canvas.reframeHint')}
            </p>
          )}

          {isLayerTool(ws.tool) && ws.view === 'image' && (
            <p className="pointer-events-none absolute top-14 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-foreground px-3 py-1 text-xs text-background shadow sm:rounded-full">
              {ws.tool === 'arrow' ? t('arrow.hint') : t('canvas.textHint')}
            </p>
          )}

          {ws.tool === 'mask' && ws.view === 'image' && (
            <p className="pointer-events-none absolute top-14 left-1/2 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl bg-foreground px-3 py-1 text-xs text-background shadow sm:rounded-full sm:whitespace-nowrap">
              <span className="sm:truncate">{t('canvas.maskHint')}</span>
              <Kbd className="shrink-0 [@media(pointer:coarse)]:hidden">Esc</Kbd>
            </p>
          )}

          {ws.tool === 'mask' && ws.view === 'image' && (
            <p className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-start gap-2 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
              <Bandage className="mt-px size-3.5 shrink-0 text-muted-foreground" />
              {t('heal.context')}
            </p>
          )}

          {/* Over the image rather than in a toolbar row: the image gets the height. */}
          {gen && ws.view === 'image' && ws.tool !== 'reframe' && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border bg-background/85 p-0.5 shadow-sm backdrop-blur">
              <ImageActions gen={gen} />
            </div>
          )}

          {failed.length > 0 && !busy && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
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
              <EditBar gen={gen} instruction={instruction} onInstruction={setInstruction} maskControls={maskControls} />
            )}
          </EditBarShell>
        )}
      </div>
    </div>
  );
}
