import { useEffect, useState } from 'react';
import {
  Bandage,
  Check,
  Blend,
  Brush,
  Copy,
  Download,
  Eraser,
  Grid2x2,
  ImageIcon,
  ImagePlus,
  Library,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  ScanLine,
  Star,
  Trash2,
  Tv,
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
import { SafeZones } from './SafeZones';
import { MaskLayer, type MaskTool } from './MaskLayer';
import { TextOverlay, TextToolbar } from './TextLayer';
import { ReframeToolbar, ReframeView } from './ReframeLayer';
import { blockingJob } from './BlockingJob';
import { FeedPreview } from './FeedPreview';
import { CompareView } from './CompareView';
import { MOD } from '../TopBar';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { fit, useElementSize } from '../../hooks/use-element-size';
import { usePinch } from '../../hooks/use-pinch';
import { clampPan, NO_ZOOM, zoomAt, type ViewZoom } from '../../lib/zoom';
import { selectedGeneration, useWorkspace, type Job, type ViewMode } from '../../stores/workspace';
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

function JobChip({ job }: { job: Job }) {
  const t = useT();
  const { cancelJob, dismissJob } = useWorkspace();
  const failed = job.status === 'failed';
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border bg-card/95 py-1 pr-1 pl-3 text-xs shadow-sm backdrop-blur',
        failed && 'border-destructive/40 text-destructive',
      )}
    >
      {failed ? <AlertCircle className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin text-primary" />}
      <span className="max-w-64 truncate">
        {failed
          ? job.error || t('canvas.failed')
          : `${job.kind === 'generate' ? t('brief.generating') : job.kind === 'upscale' ? t('export.upscaling') : t('iterate.edit')} ${t('common.seconds', { n: Math.round(job.elapsed / 1000) })}`}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        onClick={() => (failed ? dismissJob(job.id) : cancelJob(job.id))}
        aria-label={failed ? t('common.close') : t('common.cancel')}
      >
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
  const { safeZones, maskMode, textMode } = useWorkspace();
  const reframing = useWorkspace((s) => blockingJob(s.jobs)?.parentId === gen.id);
  // While its text is being edited, a text version shows its image without the text.
  const url = useBlobUrl(textMode && gen.textLayer ? gen.textLayer.base : gen.blob);
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
        <Button variant="secondary" size="xs" className="tabular absolute right-3 bottom-3 z-10 shadow" onClick={() => setZoom(NO_ZOOM)}>
          {Math.round(zoom.z * 100)} % · {t('canvas.resetZoom')}
        </Button>
      )}
      {size.width > 0 && (
        <div
          className="relative overflow-hidden rounded-lg shadow-lg ring-1 ring-border"
          style={{ ...size, transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})` }}
        >
          <img src={url} alt={gen.prompt} className={cn('size-full select-none transition-[filter] duration-300', reframing && 'blur-md')} draggable={false} />
          {safeZones && <SafeZones aspectRatio={gen.params.aspectRatio} />}
          {maskMode && <MaskLayer width={gen.width} height={gen.height} tool={tool} brushSize={brushSize} clearSignal={clearSignal} />}
          {textMode && <TextOverlay width={size.width} height={size.height} />}
        </div>
      )}
    </div>
  );
}

/**
 * 1920×1080 export. Smaller images are first upscaled by the model (a new
 * version, so it is visible and paid once), then exported from that version.
 */
async function exportFullHd(gen: Generation, t: ReturnType<typeof useT>) {
  if (gen.width >= FULL_HD_SIZE.width && gen.height >= FULL_HD_SIZE.height) return downloadForYouTube(gen, FULL_HD_SIZE);
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
  const { toggleFavorite, removeGeneration, addRef, saveToLibrary, reuse, view, safeZones, setSafeZones } = useWorkspace();
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
          <DropdownMenuItem onSelect={() => downloadBlob(gen.blob, `nanothumbnail-${gen.id.slice(2, 10)}.${extensionFor(gen.blob)}`)}>
            <Download /> {t('canvas.download')} ({gen.width}×{gen.height})
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadForYouTube(gen)}>
            <SquarePlay /> {t('canvas.exportYouTube')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportFullHd(gen, t)}>
            <SquarePlay /> {t('canvas.exportFullHd')}
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
          <DropdownMenuItem variant="destructive" onSelect={() => removeGeneration(gen.id)}>
            <Trash2 /> {t('canvas.deleteImage')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** `onDescribeRegion` (mobile): the instruction field lives in another tab, offer a way to it. */
export function CanvasArea({ onDescribeRegion }: { onDescribeRegion?: () => void }) {
  const t = useT();
  const ws = useWorkspace();
  const reframeTarget = useReframe((s) => s.target);
  const reframeZone = useReframe((s) => s.zone);
  const gen = useWorkspace(selectedGeneration);
  const [tool, setTool] = useState<MaskTool>('brush');
  const [brushSize, setBrushSize] = useState(0.05);
  const [clearSignal, setClearSignal] = useState(0);
  const running = ws.jobs.filter((j) => j.status === 'running' && j.kind === 'generate').length;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-background px-2">
        <ToggleGroup type="single" size="sm" value={ws.view} onValueChange={(v) => v && ws.setView(v as ViewMode)}>
          <ToggleGroupItem value="image" className="gap-1.5 px-2.5 text-xs" title={t('canvas.viewImage')} aria-label={t('canvas.viewImage')}>
            <ImageIcon /> <span className="hidden sm:inline">{t('canvas.viewImage')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="feed" className="gap-1.5 px-2.5 text-xs" title={t('canvas.viewFeed')} aria-label={t('canvas.viewFeed')} disabled={!gen}>
            <Tv /> <span className="hidden sm:inline">{t('canvas.viewFeed')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="compare" className="gap-1.5 px-2.5 text-xs" title={t('canvas.viewCompare')} aria-label={t('canvas.viewCompare')}>
            <Grid2x2 /> <span className="hidden sm:inline">{t('canvas.viewCompare')}</span>
            {ws.pickedIds.length > 0 && <span className="tabular text-muted-foreground">{ws.pickedIds.length}</span>}
          </ToggleGroupItem>
        </ToggleGroup>

        {gen && ws.view !== 'compare' && (
          <div className="ml-auto flex items-center">
            <ImageActions gen={gen} />
          </div>
        )}
      </div>

      {/* Mask tools get their own row: they don't fit next to the view switcher on narrow widths */}
      {ws.maskMode && ws.view === 'image' && gen && (
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-background px-2">
          <ToggleGroup type="single" size="sm" value={tool} onValueChange={(v) => v && setTool(v as MaskTool)}>
            <ToggleGroupItem value="brush" aria-label={t('canvas.brush')}>
              <Brush />
            </ToggleGroupItem>
            <ToggleGroupItem value="eraser" aria-label={t('canvas.eraser')}>
              <Eraser />
            </ToggleGroupItem>
          </ToggleGroup>
          <Slider
            className="max-w-32 min-w-10 flex-1"
            min={0.01}
            max={0.15}
            step={0.005}
            value={[brushSize]}
            onValueChange={([v]) => setBrushSize(v)}
            aria-label={t('canvas.brush')}
          />
          <Button variant="ghost" size="xs" onClick={() => setClearSignal((n) => n + 1)} aria-label={t('canvas.clearMask')}>
            <X /> <span className="hidden sm:inline">{t('canvas.clearMask')}</span>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="xs" className="ml-auto" disabled={!ws.hasMask} onClick={() => ws.smooth()}>
                <Blend /> {t('smooth.button')}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{t('smooth.hint')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="xs" disabled={!ws.hasMask} onClick={() => ws.heal()}>
                <Bandage /> {t('heal.button')}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{t('heal.hint')}</TooltipContent>
          </Tooltip>
          {onDescribeRegion && ws.hasMask && (
            <Button size="xs" onClick={onDescribeRegion}>
              {t('canvas.describeRegion')}
            </Button>
          )}
        </div>
      )}

      {ws.textMode && ws.view === 'image' && gen && <TextToolbar />}
      {ws.reframeMode && ws.view === 'image' && gen && <ReframeToolbar />}

      {/* Body */}
      <div className="relative min-h-0 flex-1">
        {ws.view === 'compare' ? (
          <CompareView />
        ) : ws.view === 'feed' && gen ? (
          <FeedPreview generation={gen} />
        ) : gen && ws.reframeMode ? (
          <ReframeView gen={gen} />
        ) : gen ? (
          <ImageView gen={gen} tool={tool} brushSize={brushSize} clearSignal={clearSignal} />
        ) : (
          <div className="flex size-full items-center justify-center">
            <EmptyState running={running} />
          </div>
        )}

        {ws.reframeMode && ws.view === 'image' && (
          <p className="pointer-events-none absolute top-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-foreground px-3 py-1 text-xs text-background shadow sm:rounded-full">
            {reframeTarget === 'zone' && !reframeZone ? t('reframe.zoneHint') : t('canvas.reframeHint')}
          </p>
        )}

        {ws.textMode && ws.view === 'image' && (
          <p className="pointer-events-none absolute top-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-foreground px-3 py-1 text-xs text-background shadow sm:rounded-full">
            {t('canvas.textHint')}
          </p>
        )}

        {ws.maskMode && ws.view === 'image' && (
          <p className="pointer-events-none absolute top-3 left-1/2 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl bg-foreground px-3 py-1 text-xs text-background shadow sm:rounded-full sm:whitespace-nowrap">
            <span className="sm:truncate">{onDescribeRegion ? t('canvas.maskHintMobile') : t('canvas.maskHint')}</span>
            <Kbd className="shrink-0 [@media(pointer:coarse)]:hidden">Esc</Kbd>
          </p>
        )}

        {ws.jobs.length > 0 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
            {ws.jobs.map((j) => (
              <JobChip key={j.id} job={j} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
