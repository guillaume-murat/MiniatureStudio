import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Download, ImagePlus, Loader2, Moon, Shuffle, Sun, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Field } from '../Section';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { fit, useElementSize } from '../../hooks/use-element-size';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { fillSlots, normaliseHandle, randomSeed, VIDEO_SLOTS } from '../../lib/channel';
import { channelLayout, PAGE } from '../../lib/channelLayout';
import { exportChannelPage, renderChannelPage, type Channel } from '../../lib/channelRender';
import { downloadBlob, normaliseUpload } from '../../lib/images';
import { rootOf, thumbnails } from '../../lib/versions';
import { useT } from '../../i18n';
import type { BrandKit, ChannelPage, Generation } from '../../lib/types';
import { cn } from '../../lib/utils';

const NO_PAGE: ChannelPage = { slots: [], dark: false, seed: 1 };

/** The page as drawn: channel details from the brand kit, the six videos filled from the project. */
function useChannelPage() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const { brand, generations, selectedId, brief, projects, projectId } = useWorkspace();
  const page = projects.find((p) => p.id === projectId)?.channelPage ?? NO_PAGE;

  return useMemo(() => {
    const byId = new Map(generations.map((g) => [g.id, g]));
    const thumbnailOf = (id: string) => rootOf(generations, id)?.id ?? id;
    const placed = Array.from({ length: VIDEO_SLOTS }, (_, i) => {
      const id = page.slots[i]?.id;
      return id && byId.has(id) ? { id, thumbnail: thumbnailOf(id) } : undefined;
    });
    // The image being worked on goes first, then the project's other thumbnails.
    const candidates = [
      ...(selectedId && byId.has(selectedId) ? [{ id: selectedId, thumbnail: thumbnailOf(selectedId) }] : []),
      ...thumbnails(generations).map((th) => ({ id: th.latest.id, thumbnail: th.root.id })),
    ];
    const ids = fillSlots(placed, candidates);
    const videos = ids.map((id, i) => {
      const gen = id ? byId.get(id) : undefined;
      const auto = gen?.videoTitle || (id === selectedId ? brief.videoTitle : '') || '';
      return { gen, title: page.slots[i]?.title ?? auto, autoTitle: auto, placed: !!placed[i] };
    });
    const name = brand.channelName.trim() || t('channel.defaultName');
    const channel: Channel = {
      name,
      handle: brand.handle ?? normaliseHandle(name),
      subscribers: brand.subscribers ?? 128_000,
      videoCount: brand.videoCount ?? 240,
      description: brand.description ?? '',
      link: '',
      extraLinks: 0,
      // Verified unless the user turned it off: the mock-up is meant to look like an established channel.
      verified: brand.verified ?? true,
      theme: page.dark ? 'dark' : 'light',
      lang,
      banner: brand.banner,
      logo: brand.logo,
      seed: page.seed,
      videos: videos.map((v) => ({ title: v.title })),
    };
    return { channel, videos, page };
  }, [brand, generations, selectedId, brief.videoTitle, page, lang, t]);
}

/** Channel details shown on the page (name and logo live in the brief panel). */
function DetailsPopover() {
  const t = useT();
  const { brand, saveBrand } = useWorkspace();
  const save = (patch: Partial<BrandKit>) => saveBrand({ ...useWorkspace.getState().brand, ...patch });
  const count = (value: string) => (value.trim() ? Math.max(0, Number(value.replace(/\D/g, '')) || 0) : undefined);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRound /> {t('channel.details')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <p className="text-xs text-muted-foreground">{t('channel.detailsHint')}</p>
        <Field label={t('channel.handle')} htmlFor="ch-handle">
          <Input
            id="ch-handle"
            defaultValue={brand.handle ?? ''}
            placeholder={normaliseHandle(brand.channelName || t('channel.defaultName'))}
            onBlur={(e) => save({ handle: e.target.value.trim() ? normaliseHandle(e.target.value) : undefined })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('channel.subscribers')} htmlFor="ch-subs">
            <Input id="ch-subs" inputMode="numeric" defaultValue={brand.subscribers ?? ''} placeholder="128000" onBlur={(e) => save({ subscribers: count(e.target.value) })} />
          </Field>
          <Field label={t('channel.videoCount')} htmlFor="ch-videos">
            <Input id="ch-videos" inputMode="numeric" defaultValue={brand.videoCount ?? ''} placeholder="240" onBlur={(e) => save({ videoCount: count(e.target.value) })} />
          </Field>
        </div>
        <Field label={t('channel.description')} htmlFor="ch-desc">
          <Textarea id="ch-desc" defaultValue={brand.description ?? ''} className="min-h-16 text-sm" onBlur={(e) => save({ description: e.target.value })} />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <BadgeCheck className="size-4 text-muted-foreground" /> {t('channel.verified')}
          </span>
          <Switch checked={brand.verified ?? true} onCheckedChange={(verified) => save({ verified })} />
        </label>
      </PopoverContent>
    </Popover>
  );
}

function PickTile({ gen, active, onClick }: { gen: Generation; active: boolean; onClick: () => void }) {
  const url = useBlobUrl(gen.blob);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('overflow-hidden rounded-md border transition-all hover:opacity-100', active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-80')}
    >
      <img src={url} alt="" className="aspect-video w-full object-cover" />
    </button>
  );
}

/** One video of the page: which thumbnail it shows, and its title. */
function SlotDialog({ index, onClose }: { index: number | null; onClose: () => void }) {
  const t = useT();
  const { videos, page } = useChannelPage();
  const generations = useWorkspace((s) => s.generations);
  const updateChannelPage = useWorkspace((s) => s.updateChannelPage);
  const video = index === null ? undefined : videos[index];
  const setSlot = (patch: { id?: string; title?: string }) => {
    if (index === null) return;
    const slots = Array.from({ length: VIDEO_SLOTS }, (_, i) => page.slots[i] ?? {});
    slots[index] = { ...slots[index], ...patch };
    updateChannelPage({ slots });
  };
  const options = thumbnails(generations);

  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('channel.video', { n: (index ?? 0) + 1 })}</DialogTitle>
          <DialogDescription>{t('channel.videoHint')}</DialogDescription>
        </DialogHeader>
        {video && (
          <div className="space-y-4">
            <Field label={t('channel.title')} htmlFor="slot-title">
              <Input
                id="slot-title"
                key={index}
                defaultValue={video.title}
                placeholder={video.autoTitle || t('channel.titlePlaceholder')}
                onBlur={(e) => setSlot({ title: e.target.value.trim() ? e.target.value : undefined })}
              />
            </Field>
            <Field label={t('channel.thumbnail')}>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('channel.noThumbnails')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {options.map((th) => (
                    <PickTile key={th.root.id} gen={th.latest} active={video.gen?.id === th.latest.id && video.placed} onClick={() => setSlot({ id: th.latest.id })} />
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="mt-1" disabled={!video.placed} onClick={() => setSlot({ id: undefined })}>
                {t('channel.auto')}
              </Button>
            </Field>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The project's thumbnails on a YouTube channel page (Videos tab), the way a
 * client would see their channel: same render as the 2560×1440 export.
 */
export function ChannelPreview() {
  const t = useT();
  const { brand, saveBrand, updateChannelPage, projects, projectId } = useWorkspace();
  const { channel, videos } = useChannelPage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ref, box] = useElementSize<HTMLDivElement>();
  const size = fit(PAGE.width / PAGE.height, { width: box.width - 32, height: box.height - 32 });
  const mounted = size.width > 0;
  const [slot, setSlot] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const hasPage = !!projects.find((p) => p.id === projectId)?.channelPage;

  // A project gets its own random statistics the first time its page is shown.
  useEffect(() => {
    if (projectId && !hasPage) updateChannelPage({ seed: randomSeed() });
  }, [projectId, hasPage, updateChannelPage]);

  const thumbs = videos.map((v) => v.gen?.blob);
  useEffect(() => {
    if (!canvas.current) return;
    const target = canvas.current;
    let stale = false;
    // Render off-screen, then copy: typing never shows a half-drawn page.
    const timer = setTimeout(async () => {
      const page = await renderChannelPage({ channel, thumbnails: thumbs });
      if (stale) return;
      target.width = page.width;
      target.height = page.height;
      target.getContext('2d')?.drawImage(page, 0, 0);
    }, 80);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, mounted, ...thumbs]);

  function pickBanner() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) saveBrand({ ...useWorkspace.getState().brand, banner: await normaliseUpload(file, 2560) });
    };
    input.click();
  }

  /** Clicking a video (thumbnail or title) opens its settings. */
  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * PAGE.width;
    const y = ((e.clientY - r.top) / r.height) * PAGE.height;
    const index = channelLayout().cards.findIndex((c) => x >= c.thumb.x && x <= c.thumb.x + c.thumb.w && y >= c.thumb.y && y <= c.title.y + c.title.h + 24);
    if (index >= 0) setSlot(index);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="flex items-center">
          <Button variant="outline" size="sm" className={cn(brand.banner && 'rounded-r-none')} onClick={pickBanner}>
            <ImagePlus /> {t('channel.banner')}
          </Button>
          {brand.banner && (
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-l-none border-l-0"
              onClick={() => saveBrand({ ...useWorkspace.getState().brand, banner: undefined })}
              aria-label={t('common.remove')}
            >
              <X />
            </Button>
          )}
        </div>
        <DetailsPopover />
        <Button variant="ghost" size="icon-sm" onClick={() => updateChannelPage({ dark: channel.theme !== 'dark' })} aria-label={t('channel.dark')} aria-pressed={channel.theme === 'dark'}>
          {channel.theme === 'dark' ? <Moon /> : <Sun />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => updateChannelPage({ seed: randomSeed() })} title={t('channel.shuffleHint')}>
          <Shuffle /> {t('feed.shuffle')}
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              downloadBlob(await exportChannelPage({ channel, thumbnails: thumbs }), 'chaine-youtube-2560x1440.png');
            } catch {
              toast.error(t('errors.network'));
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? <Loader2 className="animate-spin" /> : <Download />} {t('channel.export')}
        </Button>
      </div>
      <div ref={ref} className="relative flex min-h-0 flex-1 items-center justify-center">
        {mounted && (
          <canvas
            ref={canvas}
            role="img"
            aria-label={t('channel.preview')}
            width={PAGE.outputWidth}
            height={PAGE.outputHeight}
            onClick={onCanvasClick}
            className="cursor-pointer rounded-lg bg-muted shadow-lg ring-1 ring-border"
            style={size}
          />
        )}
        <p className="pointer-events-none absolute bottom-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-1 text-xs text-background">
          {t('channel.hint')}
        </p>
      </div>
      <SlotDialog index={slot} onClose={() => setSlot(null)} />
    </div>
  );
}
