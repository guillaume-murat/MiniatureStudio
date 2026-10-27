import { useMemo, useState } from 'react';
import { Moon, Shuffle, Sun } from 'lucide-react';
import { Button } from '../ui/button';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { FEED, feedAsset, formatAgo, formatCount, formatDuration, shuffled, type FeedVideo } from '../../lib/feedVideos';
import { useT } from '../../i18n';
import type { Generation } from '../../lib/types';
import { cn } from '../../lib/utils';

type FeedMode = 'home' | 'search' | 'sidebar' | 'mobile' | 'tv';

/** How many cards each layout shows (the selected thumbnail is one of them). */
const COUNTS: Record<FeedMode, number> = { home: 12, search: 6, sidebar: 10, mobile: 6, tv: 8 };

interface Card {
  id: string;
  src?: string;
  title: string;
  channel: string;
  logo?: string;
  meta: string;
  description?: string;
  duration: string;
  mine?: boolean;
}

/** YouTube feed palette, independent from the app theme. */
function palette(dark: boolean) {
  return dark
    ? { bg: '#0f0f0f', fg: '#f1f1f1', muted: '#aaaaaa', placeholder: '#272727' }
    : { bg: '#ffffff', fg: '#0f0f0f', muted: '#606060', placeholder: '#e5e5e5' };
}

function Thumbnail({ card, className, dark }: { card: Card; className?: string; dark: boolean }) {
  const colors = palette(dark);
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl', className)} style={{ background: colors.placeholder }}>
      {card.src && <img src={card.src} alt="" className="size-full object-cover" draggable={false} loading="lazy" />}
      <span className="absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1 py-px text-[11px] leading-4 font-medium text-white">
        {card.duration}
      </span>
    </div>
  );
}

function Avatar({ card, dark, size = 36 }: { card: Card; dark: boolean; size?: number }) {
  const colors = palette(dark);
  return card.logo ? (
    <img src={card.logo} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="shrink-0 rounded-full" style={{ width: size, height: size, background: card.mine ? 'var(--primary)' : colors.placeholder }} />
  );
}

function Meta({ card, dark, size = 'md', avatar = true }: { card: Card; dark: boolean; size?: 'sm' | 'md' | 'lg'; avatar?: boolean }) {
  const colors = palette(dark);
  const titleSize = size === 'sm' ? 'text-[13px] leading-[18px]' : size === 'lg' ? 'text-lg leading-6' : 'text-[15px] leading-[21px]';
  return (
    <div className="flex gap-3 pt-2.5">
      {avatar && <Avatar card={card} dark={dark} />}
      <div className="min-w-0">
        <p className={cn('line-clamp-2 font-medium', titleSize)} style={{ color: colors.fg }}>
          {card.title}
        </p>
        <p className="mt-0.5 truncate text-xs" style={{ color: colors.muted }}>
          {card.channel}
        </p>
        <p className="text-xs" style={{ color: colors.muted }}>
          {card.meta}
        </p>
      </div>
    </div>
  );
}

/** YouTube search result: big thumbnail, then title, stats, channel, description. */
function SearchResult({ card, dark }: { card: Card; dark: boolean }) {
  const colors = palette(dark);
  return (
    <div className="flex gap-4">
      <Thumbnail card={card} dark={dark} className="w-[45%] max-w-[360px] shrink-0" />
      <div className="min-w-0 space-y-1.5">
        <p className="line-clamp-2 text-lg leading-6" style={{ color: colors.fg }}>
          {card.title}
        </p>
        <p className="text-xs" style={{ color: colors.muted }}>
          {card.meta}
        </p>
        <div className="flex items-center gap-2 py-1.5">
          <Avatar card={card} dark={dark} size={24} />
          <span className="truncate text-xs" style={{ color: colors.muted }}>
            {card.channel}
          </span>
        </div>
        {card.description && (
          <p className="line-clamp-2 text-xs" style={{ color: colors.muted }}>
            {card.description}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The selected thumbnail alone among real YouTube videos bundled with the app
 * (`npm run feed:update`), drawn at random for each layout.
 */
export function FeedPreview({ generation }: { generation: Generation }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [mode, setMode] = useState<FeedMode>('home');
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const { brief, brand } = useWorkspace();
  const mineSrc = useBlobUrl(generation.blob);
  const logo = useBlobUrl(brand.logo);

  const cards = useMemo<Card[]>(() => {
    const count = COUNTS[mode];
    const toCard = (v: FeedVideo): Card => ({
      id: v.id,
      src: feedAsset(v.thumbnail),
      title: v.title,
      channel: v.channel,
      logo: feedAsset(v.channelLogo),
      // Ages as of the snapshot, so the feed doesn't look stale months later.
      meta: `${t('feed.views', { n: formatCount(v.views, lang) })} · ${formatAgo(v.publishedAt, lang, Date.parse(FEED.fetchedAt))}`,
      description: v.description,
      duration: formatDuration(v.duration),
    });
    const mine: Card = {
      id: 'mine',
      src: mineSrc,
      title: generation.videoTitle || brief.videoTitle || t('feed.noTitle'),
      channel: brand.channelName || t('feed.channel'),
      logo,
      meta: `${t('feed.views', { n: formatCount(2_000 + (seed % 90_000), lang) })} · ${t('feed.ago')}`,
      description: brief.brief,
      duration: '12:34',
      mine: true,
    };
    // A different draw per layout, stable until the user reshuffles.
    const offset = Object.keys(COUNTS).indexOf(mode);
    const others = shuffled(FEED.videos, seed + offset).slice(0, count - 1).map(toCard);
    const at = (seed + offset * 7) % count;
    return [...others.slice(0, at), mine, ...others.slice(at)];
  }, [mode, seed, lang, mineSrc, logo, generation.videoTitle, brief.videoTitle, brief.brief, brand.channelName, t]);

  const colors = palette(dark);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <ToggleGroup type="single" size="sm" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as FeedMode)}>
          {(['home', 'search', 'sidebar', 'mobile', 'tv'] as const).map((m) => (
            <ToggleGroupItem key={m} value={m} className="px-2.5 text-xs">
              {t(`feed.${m}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="ghost" size="icon-sm" onClick={() => setDark(!dark)} aria-label={t('feed.darkFeed')} aria-pressed={dark}>
          {dark ? <Moon /> : <Sun />}
        </Button>
        <div className="ml-auto" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
              <Shuffle /> {t('feed.shuffle')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('feed.shuffleHint', { date: new Date(FEED.fetchedAt).toLocaleDateString(lang) })}</TooltipContent>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" style={{ background: colors.bg, fontFamily: 'Roboto, Arial, sans-serif' }}>
        {mode === 'home' && (
          <div className="mx-auto grid max-w-[1400px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-4 gap-y-8 p-6">
            {cards.map((c) => (
              <div key={c.id}>
                <Thumbnail card={c} dark={dark} />
                <Meta card={c} dark={dark} />
              </div>
            ))}
          </div>
        )}

        {mode === 'search' && (
          <div className="mx-auto max-w-[1100px] space-y-4 p-6">
            {cards.map((c) => (
              <SearchResult key={c.id} card={c} dark={dark} />
            ))}
          </div>
        )}

        {mode === 'sidebar' && (
          <div className="flex gap-6 p-6">
            <div className="hidden flex-1 lg:block">
              <div className="aspect-video w-full rounded-xl" style={{ background: colors.placeholder }} />
            </div>
            <div className="w-[402px] shrink-0 space-y-2">
              {cards.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Thumbnail card={c} dark={dark} className="w-[168px] shrink-0 rounded-lg" />
                  <div className="-mt-2.5 min-w-0">
                    <Meta card={c} dark={dark} size="sm" avatar={false} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'mobile' && (
          <div className="flex justify-center py-6">
            <div className="w-[375px] overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 shadow-2xl" style={{ background: colors.bg }}>
              <div className="h-[720px] space-y-4 overflow-y-auto pb-6">
                {cards.map((c) => (
                  <div key={c.id}>
                    <Thumbnail card={c} dark={dark} className="rounded-none" />
                    <div className="px-3">
                      <Meta card={c} dark={dark} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === 'tv' && (
          <div className="min-h-full p-10" style={{ background: '#0f0f0f' }}>
            <div className="grid grid-cols-4 gap-5">
              {cards.map((c) => (
                <div key={c.id} className={cn('rounded-xl transition-transform', c.mine && 'scale-105')}>
                  <Thumbnail card={c} dark className={cn(c.mine && 'ring-4 ring-white')} />
                  <p className="mt-2 line-clamp-1 text-sm text-white/90">{c.title}</p>
                  <p className="line-clamp-1 text-xs text-white/50">{c.channel}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
