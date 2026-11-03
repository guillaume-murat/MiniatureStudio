import { useState } from 'react';
import { Check, Download, GitBranch, Grid2x2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Toggle } from './ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { ImageMenu } from './ImageMenu';
import { useBlobUrl } from '../hooks/use-blob-url';
import { useWorkspace } from '../stores/workspace';
import { exportTestCompare } from '../lib/exporting';
import { thumbnails } from '../lib/versions';
import { useT } from '../i18n';
import type { Generation } from '../lib/types';
import { cn } from '../lib/utils';

/** Thumbnail height in the strip, in pixels. */
const TILE_HEIGHT = 84;

/** One thumbnail: its video title, then the version being worked on (or its latest), with how many versions it has. */
function Tile({
  gen,
  title,
  count,
  selected,
  picked,
  onSelect,
  onPick,
  onDuplicate,
  pickLabel,
}: {
  gen: Generation;
  /** The video title, or '' when there is none. */
  title: string;
  count: number;
  selected: boolean;
  picked: boolean;
  onSelect: (e: React.MouseEvent | React.KeyboardEvent) => void;
  onPick: () => void;
  onDuplicate: () => void;
  pickLabel: string;
}) {
  const t = useT();
  const url = useBlobUrl(gen.blob);
  // Explicit pixel sizes: WebKit (the macOS app) let the image's own width win over a percentage height + aspect-ratio.
  const width = Math.round((TILE_HEIGHT * gen.width) / gen.height);
  return (
    <div className="flex shrink-0 flex-col gap-1" style={{ width }}>
      <p className={cn('truncate text-[10px] leading-3', title ? 'text-foreground/80' : 'text-muted-foreground italic')}>{title || t('filmstrip.untitled')}</p>
      <ImageMenu onDuplicate={onDuplicate}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(e)}
            aria-label={title || t('filmstrip.untitled')}
            className={cn(
              'group relative shrink-0 cursor-pointer overflow-hidden rounded-md border bg-muted transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-80 hover:opacity-100',
            )}
            style={{ width, height: TILE_HEIGHT }}
          >
            <img src={url} alt="" className="size-full object-cover" loading="lazy" draggable={false} />
            {gen.favorite && <Star className="absolute top-1 left-1 size-3 fill-amber-400 text-amber-400 drop-shadow" />}
            {count > 1 && (
              <span className="tabular absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/70 px-1 text-[10px] leading-4 font-medium text-white">
                <GitBranch className="size-2.5" /> {count}
              </span>
            )}
            <button
              type="button"
              aria-label={pickLabel}
              aria-pressed={picked}
              onClick={(e) => {
                e.stopPropagation();
                onPick();
              }}
              className={cn(
                'absolute top-1 right-1 flex size-4 items-center justify-center rounded-full border border-white/80 bg-black/40 text-white transition-opacity',
                picked
                  ? 'border-primary bg-primary text-primary-foreground opacity-100'
                  : 'opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100',
              )}
            >
              {picked && <Check className="size-3" />}
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{title || t('filmstrip.untitled')}</TooltipContent>
      </Tooltip>
      </ImageMenu>
    </div>
  );
}

export function Filmstrip() {
  const t = useT();
  const { generations, selectedId, pickedIds, jobs, select, togglePick, clearPicks, setView, duplicateSelected } = useWorkspace();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const all = thumbnails(generations);
  const isFavorite = (th: (typeof all)[number]) => th.versions.some((g) => g.favorite);
  const favorites = all.filter(isFavorite).length;
  const shown = favoritesOnly ? all.filter(isFavorite) : all;
  const projectName = useWorkspace((s) => s.projects.find((p) => p.id === s.projectId)?.name ?? '');
  const pending = jobs.filter((j) => j.status === 'running' && j.kind === 'generate').length;

  return (
    <div className="shrink-0 border-t bg-background">
      <div className="flex h-9 items-center gap-2 overflow-hidden px-3 text-xs">
        {/* The project and its counts come first; the export hint gives way when space runs out. */}
        <span className="min-w-0 shrink-0 truncate text-muted-foreground">
          <span className="font-medium text-foreground">{projectName}</span>
          <span className="tabular">
            {' · '}
            {all.length === 1 ? t('filmstrip.countOne') : t('filmstrip.count', { n: all.length })}, {t('filmstrip.favorites', { n: favorites })}
          </span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle size="sm" className="h-6 min-w-6 shrink-0 px-1" pressed={favoritesOnly} onPressedChange={setFavoritesOnly} aria-label={t('filmstrip.favoritesOnly')}>
              <Star className={cn('size-3.5', favoritesOnly && 'fill-amber-400 text-amber-400')} />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{t('filmstrip.favoritesOnly')}</TooltipContent>
        </Tooltip>

        {pickedIds.length > 0 ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button size="xs" variant="secondary" onClick={() => setView('compare')} disabled={pickedIds.length < 2}>
              <Grid2x2 /> {t('canvas.viewCompare')} ({pickedIds.length})
            </Button>
            <Button
              size="xs"
              onClick={async () => {
                await exportTestCompare(pickedIds.map((id) => generations.find((g) => g.id === id)).filter((g): g is Generation => !!g));
                toast.success(t('filmstrip.exported'));
              }}
            >
              <Download /> {t('filmstrip.exportTestCompare', { n: Math.min(pickedIds.length, 3) })}
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={clearPicks} aria-label={t('common.close')}>
              <X />
            </Button>
          </div>
        ) : (
          all.length > 1 && (
            <span className="ml-auto hidden min-w-0 truncate text-muted-foreground xl:block">
              {t('filmstrip.exportHint')} · {t('filmstrip.shiftClick')}
            </span>
          )
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 pt-1 pb-3">
        {Array.from({ length: pending }).map((_, i) => (
          <div key={`p${i}`} className="mt-4 aspect-video shrink-0 animate-pulse rounded-md bg-muted" style={{ height: TILE_HEIGHT }} />
        ))}
        {shown.length === 0 && pending === 0 && (
          <p className="flex items-center text-xs text-muted-foreground" style={{ height: TILE_HEIGHT + 16 }}>
            {t('filmstrip.empty')}
          </p>
        )}
        {shown.map((th) => {
          const current = th.versions.find((g) => g.id === selectedId);
          const shownVersion = current ?? th.latest;
          const picked = th.versions.filter((g) => pickedIds.includes(g.id));
          // Picking works per thumbnail: one of its versions at most.
          const pick = () => (picked.length ? picked.forEach((g) => togglePick(g.id)) : togglePick(shownVersion.id));
          return (
            <Tile
              key={th.root.id}
              gen={shownVersion}
              title={shownVersion.videoTitle?.trim() ?? ''}
              count={th.versions.length}
              selected={!!current}
              picked={picked.length > 0}
              onSelect={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? pick() : select(shownVersion.id))}
              onPick={pick}
              onDuplicate={() => {
                select(shownVersion.id);
                void duplicateSelected();
              }}
              pickLabel={t('filmstrip.selectForExport')}
            />
          );
        })}
      </div>
    </div>
  );
}
