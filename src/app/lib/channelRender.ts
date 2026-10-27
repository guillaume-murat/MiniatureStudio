import {
  Bell,
  Check,
  ChevronRight,
  Clapperboard,
  Clock,
  Download,
  EllipsisVertical,
  Flame,
  Gamepad2,
  House,
  ListVideo,
  Menu,
  Mic,
  Music2,
  Newspaper,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  SquarePlay,
  ThumbsUp,
  Trophy,
  TvMinimalPlay,
  Zap,
  type IconNode,
} from 'lucide';
import roboto400 from '@fontsource/roboto/files/roboto-latin-400-normal.woff2?url';
import roboto500 from '@fontsource/roboto/files/roboto-latin-500-normal.woff2?url';
import roboto700 from '@fontsource/roboto/files/roboto-latin-700-normal.woff2?url';
import { channelLayout, coverCrop, PAGE, SCALE, type Rect } from './channelLayout';
import {
  ellipsis,
  formatAge,
  formatDuration,
  formatSubscribers,
  formatVideoCount,
  formatViews,
  initials,
  videoStats,
  wrapText,
} from './channel';
import type { MockLang } from './channel';

/**
 * Draws the channel page mock-up on a canvas, deterministically, from the
 * channel details and the thumbnails placed on it (ported from NanoChannel).
 * Nothing here asks a model to draw: the page is composed like a screenshot
 * would be, at exactly 2560×1440.
 */

/** What the page shows: the channel (brand kit) and its six videos. */
export interface Channel {
  name: string;
  /** "@handle", or '' to leave it out. */
  handle: string;
  subscribers: number;
  videoCount: number;
  description: string;
  /** First link under the description ('' = no links line). */
  link: string;
  extraLinks: number;
  verified: boolean;
  theme: 'light' | 'dark';
  lang: MockLang;
  banner?: Blob;
  logo?: Blob;
  /** Seed for the random view counts, durations and upload ages. */
  seed: number;
  videos: Array<{ title: string }>;
}

export interface ChannelPageInput {
  channel: Channel;
  /** Thumbnail per video, in `channel.videos` order. */
  thumbnails: Array<Blob | undefined>;
}

const FONT = 'Roboto, "Helvetica Neue", Arial, sans-serif';

/** Interface strings of the mock-up, in its own language (not the studio's). */
const LABELS: Record<MockLang, {
  sidebar: { main: string[]; you: string; youItems: string[]; explore: string; exploreItems: string[] };
  search: string;
  create: string;
  subscribe: string;
  join: string;
  more: string;
  andLinks: (n: number) => string;
  tabs: string[];
  chips: string[];
  untitled: (n: number) => string;
}> = {
  fr: {
    sidebar: {
      main: ['Accueil', 'Shorts', 'Abonnements'],
      you: 'Vous',
      youItems: ['Historique', 'Playlists', 'Vos vidéos', 'À regarder plus tard', 'Vidéos « J’aime »', 'Téléchargements'],
      explore: 'Explorer',
      exploreItems: ['Tendances', 'Musique', 'Films', 'Direct', 'Jeux vidéo', 'Actualités', 'Sport'],
    },
    search: 'Rechercher',
    create: 'Créer',
    subscribe: 'S’abonner',
    join: 'Rejoindre',
    more: 'plus',
    andLinks: (n) => ` et ${n} autre${n > 1 ? 's' : ''} lien${n > 1 ? 's' : ''}`,
    tabs: ['Accueil', 'Vidéos', 'Shorts', 'Playlists', 'Posts'],
    chips: ['Les plus récentes', 'Populaires', 'Les plus anciennes'],
    untitled: (n) => `Titre de la vidéo ${n}`,
  },
  en: {
    sidebar: {
      main: ['Home', 'Shorts', 'Subscriptions'],
      you: 'You',
      youItems: ['History', 'Playlists', 'Your videos', 'Watch later', 'Liked videos', 'Downloads'],
      explore: 'Explore',
      exploreItems: ['Trending', 'Music', 'Movies', 'Live', 'Gaming', 'News', 'Sports'],
    },
    search: 'Search',
    create: 'Create',
    subscribe: 'Subscribe',
    join: 'Join',
    more: 'more',
    andLinks: (n) => ` and ${n} more link${n > 1 ? 's' : ''}`,
    tabs: ['Home', 'Videos', 'Shorts', 'Playlists', 'Posts'],
    chips: ['Latest', 'Popular', 'Oldest'],
    untitled: (n) => `Video title ${n}`,
  },
};

const ICONS = {
  main: [House, Zap, TvMinimalPlay],
  you: [RotateCcw, ListVideo, SquarePlay, Clock, ThumbsUp, Download],
  explore: [Flame, Music2, Clapperboard, Radio, Gamepad2, Newspaper, Trophy],
};

function palette(theme: Channel['theme']) {
  return theme === 'dark'
    ? {
        bg: '#0f0f0f', fg: '#f1f1f1', muted: '#aaaaaa', soft: '#272727', divider: '#3f3f3f', placeholder: '#272727',
        link: '#3ea6ff', inverseBg: '#f1f1f1', inverseFg: '#0f0f0f', searchBorder: '#303030', searchBg: '#121212', searchButton: '#222222',
      }
    : {
        bg: '#ffffff', fg: '#0f0f0f', muted: '#606060', soft: '#f2f2f2', divider: '#e5e5e5', placeholder: '#e5e5e5',
        link: '#065fd4', inverseBg: '#0f0f0f', inverseFg: '#ffffff', searchBorder: '#d3d3d3', searchBg: '#ffffff', searchButton: '#f8f8f8',
      };
}
type Palette = ReturnType<typeof palette>;

let fontsReady: Promise<void> | null = null;

/** Roboto is bundled: system fonts would make the export depend on the machine. */
export function loadPageFonts(): Promise<void> {
  fontsReady ??= (async () => {
    const faces = [
      new FontFace('Roboto', `url(${roboto400})`, { weight: '400' }),
      new FontFace('Roboto', `url(${roboto500})`, { weight: '500' }),
      new FontFace('Roboto', `url(${roboto700})`, { weight: '700' }),
    ];
    await Promise.all(
      faces.map(async (face) => {
        try {
          document.fonts.add(await face.load());
        } catch {
          /* fall back to the system sans-serif */
        }
      }),
    );
  })();
  return fontsReady;
}

// ─── Drawing primitives ──────────────────────────────────

function font(ctx: CanvasRenderingContext2D, size: number, weight: 400 | 500 | 700 = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number, color: string | CanvasGradient) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function points(value: unknown): number[] {
  return String(value ?? '').trim().split(/[\s,]+/).map(Number);
}

/** Strokes a Lucide icon (24×24 grid) at `x`,`y`, `size` px wide. */
function icon(ctx: CanvasRenderingContext2D, node: IconNode, x: number, y: number, size: number, color: string, weight = 1.75) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [tag, a] of node) {
    const n = (k: string) => Number(a[k] ?? 0);
    ctx.beginPath();
    switch (tag) {
      case 'path':
        ctx.stroke(new Path2D(String(a.d)));
        continue;
      case 'circle':
        ctx.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2);
        break;
      case 'ellipse':
        ctx.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, Math.PI * 2);
        break;
      case 'rect':
        ctx.roundRect(n('x'), n('y'), n('width'), n('height'), n('rx'));
        break;
      case 'line':
        ctx.moveTo(n('x1'), n('y1'));
        ctx.lineTo(n('x2'), n('y2'));
        break;
      case 'polyline':
      case 'polygon': {
        const p = points(a.points);
        for (let i = 0; i + 1 < p.length; i += 2) (i ? ctx.lineTo(p[i], p[i + 1]) : ctx.moveTo(p[i], p[i + 1]));
        if (tag === 'polygon') ctx.closePath();
        break;
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, r: Rect, radius: number) {
  const src = coverCrop(img.width, img.height, r);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, src.x, src.y, src.w, src.h, r.x, r.y, r.w, r.h);
  ctx.restore();
}

function pill(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, h: number, bg: string, fg: string, opts: { size?: number; padding?: number; radius?: number; iconNode?: IconNode } = {}): number {
  const size = opts.size ?? 14;
  const padding = opts.padding ?? 16;
  font(ctx, size, 500);
  const iconSpace = opts.iconNode ? 30 : 0;
  const w = ctx.measureText(label).width + padding * 2 + iconSpace;
  roundRect(ctx, { x, y, w, h }, opts.radius ?? h / 2, bg);
  if (opts.iconNode) icon(ctx, opts.iconNode, x + padding - 4, y + (h - 24) / 2, 24, fg, 2);
  text(ctx, label, x + padding + iconSpace, y + h / 2 + size * 0.36, fg);
  return w;
}

// ─── Page sections ───────────────────────────────────────

function drawMasthead(ctx: CanvasRenderingContext2D, p: Palette, lang: MockLang, logo: ImageBitmap | null, channel: Channel) {
  const L = LABELS[lang];
  icon(ctx, Menu, 24, 16, 24, p.fg);
  // Generic play-button wordmark, drawn rather than copied.
  roundRect(ctx, { x: 76, y: 18, w: 29, h: 20 }, 6, '#ff0033');
  ctx.beginPath();
  ctx.moveTo(87, 23);
  ctx.lineTo(95.5, 28);
  ctx.lineTo(87, 33);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  font(ctx, 21, 700);
  ctx.save();
  ctx.letterSpacing = '-1px';
  text(ctx, 'YouTube', 108, 35, p.fg);
  const wordmark = ctx.measureText('YouTube').width;
  ctx.restore();
  font(ctx, 10, 400);
  text(ctx, lang.toUpperCase(), 108 + wordmark + 2, 22, p.muted);

  // Search box, centred on the page
  const searchW = 536;
  const sx = PAGE.width / 2 - (searchW + 64) / 2;
  ctx.beginPath();
  ctx.roundRect(sx, 8, searchW + 64, 40, 20);
  ctx.fillStyle = p.searchBg;
  ctx.fill();
  ctx.strokeStyle = p.searchBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(sx + searchW, 8.5, 63.5, 39, [0, 20, 20, 0]);
  ctx.fillStyle = p.searchButton;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx + searchW, 8);
  ctx.lineTo(sx + searchW, 48);
  ctx.stroke();
  font(ctx, 16, 400);
  text(ctx, L.search, sx + 20, 33, p.muted);
  icon(ctx, Search, sx + searchW + 20, 16, 24, p.fg);
  roundRect(ctx, { x: sx + searchW + 64 + 16, y: 8, w: 40, h: 40 }, 20, p.soft);
  icon(ctx, Mic, sx + searchW + 64 + 24, 16, 24, p.fg);

  // Right: Create, notifications, account
  const avatarX = PAGE.width - 24 - 32;
  icon(ctx, Bell, avatarX - 52, 16, 24, p.fg);
  font(ctx, 14, 500);
  const createW = ctx.measureText(L.create).width + 16 + 30 + 4;
  pill(ctx, L.create, avatarX - 76 - createW, 10, 36, p.soft, p.fg, { iconNode: Plus, padding: 14 });
  avatarCircle(ctx, { x: avatarX, y: 12, w: 32, h: 32 }, logo, channel);
}

function avatarCircle(ctx: CanvasRenderingContext2D, r: Rect, logo: ImageBitmap | null, channel: Channel) {
  if (logo) return drawImageCover(ctx, logo, r, r.w / 2);
  roundRect(ctx, r, r.w / 2, channel.theme === 'dark' ? '#3a3a3a' : '#5f6368');
  font(ctx, Math.round(r.w * 0.38), 500);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials(channel.name), r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawSidebar(ctx: CanvasRenderingContext2D, p: Palette, lang: MockLang) {
  const L = LABELS[lang].sidebar;
  const { sidebar, sidebarItemHeight: h } = channelLayout();
  let y = sidebar.y + 12;
  const item = (label: string, node: IconNode) => {
    icon(ctx, node, 24, y + 8, 24, p.fg);
    font(ctx, 14, 400);
    text(ctx, ellipsis(label, 140, (s) => ctx.measureText(s).width), 72, y + 25, p.fg);
    y += h;
  };
  const divider = () => {
    ctx.fillStyle = p.divider;
    ctx.fillRect(12, y + 12, sidebar.w - 24, 1);
    y += 25;
  };
  const heading = (label: string, chevron: boolean) => {
    font(ctx, 16, 500);
    text(ctx, label, 24, y + 26, p.fg);
    if (chevron) icon(ctx, ChevronRight, 24 + ctx.measureText(label).width + 6, y + 12, 16, p.fg, 2.25);
    y += h;
  };
  L.main.forEach((label, i) => item(label, ICONS.main[i]));
  divider();
  heading(L.you, true);
  L.youItems.forEach((label, i) => item(label, ICONS.you[i]));
  divider();
  heading(L.explore, false);
  L.exploreItems.forEach((label, i) => item(label, ICONS.explore[i]));
}

function drawHeader(ctx: CanvasRenderingContext2D, p: Palette, channel: Channel, banner: ImageBitmap | null, logo: ImageBitmap | null) {
  const L = LABELS[channel.lang];
  const layout = channelLayout();
  const { info } = layout;
  const measure = (s: string) => ctx.measureText(s).width;

  if (banner) drawImageCover(ctx, banner, layout.banner, 16);
  else {
    const g = ctx.createLinearGradient(layout.banner.x, 0, layout.banner.x + layout.banner.w, 0);
    g.addColorStop(0, '#2563eb');
    g.addColorStop(1, '#10b981');
    roundRect(ctx, layout.banner, 16, g);
    font(ctx, 64, 700);
    text(ctx, ellipsis(channel.name.toUpperCase(), layout.banner.w - 80, measure), layout.banner.x + layout.banner.w / 2, layout.banner.y + layout.banner.h / 2 + 23, '#ffffff', 'center');
  }

  avatarCircle(ctx, layout.avatar, logo, channel);

  // Name + verified badge
  font(ctx, 36, 700);
  const name = ellipsis(channel.name || '—', info.maxWidth - 40, measure);
  text(ctx, name, info.x, info.nameY, p.fg);
  if (channel.verified) {
    const bx = info.x + measure(name) + 10;
    ctx.beginPath();
    ctx.arc(bx + 9, info.nameY - 12, 9, 0, Math.PI * 2);
    ctx.fillStyle = p.muted;
    ctx.fill();
    icon(ctx, Check, bx + 3, info.nameY - 18, 12, p.bg, 3.5);
  }

  // @handle · subscribers · videos
  const meta = [channel.handle, formatSubscribers(channel.subscribers, channel.lang), formatVideoCount(channel.videoCount, channel.lang)]
    .filter(Boolean);
  font(ctx, 14, 500);
  const handleW = channel.handle ? measure(channel.handle) : 0;
  if (channel.handle) text(ctx, channel.handle, info.x, info.metaY, p.fg);
  font(ctx, 14, 400);
  const rest = meta.slice(channel.handle ? 1 : 0).join(' • ');
  text(ctx, `${channel.handle ? ' • ' : ''}${rest}`, info.x + handleW, info.metaY, p.muted);

  // Description, one line, "…plus"
  if (channel.description.trim()) {
    font(ctx, 14, 500);
    const room = Math.min(info.maxWidth, 620) - measure(` ${L.more}`);
    font(ctx, 14, 400);
    const desc = ellipsis(channel.description.replace(/\s+/g, ' '), room, measure);
    const descW = measure(desc);
    text(ctx, desc, info.x, info.descY, p.muted);
    font(ctx, 14, 500);
    text(ctx, ` ${L.more}`, info.x + descW, info.descY, p.fg);
  }

  // Links
  if (channel.link.trim()) {
    font(ctx, 14, 500);
    const link = ellipsis(channel.link.trim().replace(/^https?:\/\//, ''), 360, measure);
    text(ctx, link, info.x, info.linksY, p.link);
    if (channel.extraLinks > 0) text(ctx, L.andLinks(channel.extraLinks), info.x + measure(link), info.linksY, p.fg);
  }

  // Subscribe / Join
  const by = channel.link.trim() ? info.buttonsY : info.buttonsY - 26;
  const subW = pill(ctx, L.subscribe, info.x, by, info.buttonHeight, p.inverseBg, p.inverseFg);
  pill(ctx, L.join, info.x + subW + 8, by, info.buttonHeight, p.soft, p.fg);

  // Tabs, "Videos" selected
  const { tabs, chips, content } = layout;
  let tx = content.x;
  const baseline = tabs.y + tabs.height / 2 + 6;
  L.tabs.forEach((label, i) => {
    font(ctx, 16, 500);
    const w = measure(label);
    text(ctx, label, tx, baseline, i === 1 ? p.fg : p.muted);
    if (i === 1) {
      ctx.fillStyle = p.fg;
      ctx.fillRect(tx, tabs.y + tabs.height - 2, w, 2);
    }
    tx += w + 24;
  });
  icon(ctx, Search, tx, tabs.y + tabs.height / 2 - 12, 24, p.muted);
  ctx.fillStyle = p.divider;
  ctx.fillRect(content.x, tabs.y + tabs.height, content.w, 1);

  // Sort chips, "Latest" selected
  let cx = content.x;
  L.chips.forEach((label, i) => {
    cx += pill(ctx, label, cx, chips.y, chips.height, i === 0 ? p.inverseBg : p.soft, i === 0 ? p.inverseFg : p.fg, { padding: 12, radius: 8 }) + 12;
  });
}

function drawCards(ctx: CanvasRenderingContext2D, p: Palette, channel: Channel, thumbs: Array<ImageBitmap | null>) {
  const L = LABELS[channel.lang];
  const stats = videoStats(channel.seed, channel.videos.length);
  const measure = (s: string) => ctx.measureText(s).width;
  channelLayout().cards.forEach((card, i) => {
    const video = channel.videos[i];
    if (!video) return;
    const thumb = thumbs[i];
    if (thumb) drawImageCover(ctx, thumb, card.thumb, 12);
    else {
      roundRect(ctx, card.thumb, 12, p.placeholder);
      icon(ctx, Play, card.thumb.x + card.thumb.w / 2 - 24, card.thumb.y + card.thumb.h / 2 - 24, 48, p.muted, 1.5);
    }

    // Duration badge
    const s = stats[i];
    font(ctx, 12, 500);
    const duration = formatDuration(s.durationSec);
    const bw = measure(duration) + 8;
    const badge = { x: card.thumb.x + card.thumb.w - 8 - bw, y: card.thumb.y + card.thumb.h - 8 - 18, w: bw, h: 18 };
    roundRect(ctx, badge, 4, 'rgba(0, 0, 0, 0.8)');
    text(ctx, duration, badge.x + 4, badge.y + 13.5, '#ffffff');

    // Title (two lines max), stats, ⋮
    font(ctx, 16, 500);
    const title = video.title.trim() || L.untitled(i + 1);
    const lines = wrapText(title, card.title.w, 2, measure);
    lines.forEach((line, j) => text(ctx, line, card.title.x, card.title.y + 16 + j * card.titleLineHeight, video.title.trim() ? p.fg : p.muted));
    const lastBaseline = card.title.y + 16 + (lines.length - 1) * card.titleLineHeight;
    font(ctx, 14, 400);
    const line = `${formatViews(s.views, channel.lang)} • ${formatAge(s.ageHours, channel.lang)}`;
    text(ctx, ellipsis(line, card.thumb.w, measure), card.title.x, lastBaseline + card.statsGap, p.muted);
    icon(ctx, EllipsisVertical, card.menu.x, card.menu.y, 24, p.fg);
  });
}

async function bitmap(blob: Blob | undefined): Promise<ImageBitmap | null> {
  if (!blob) return null;
  try {
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

/** Renders the page on `target` (or a new canvas) at 2560×1440. */
export async function renderChannelPage(input: ChannelPageInput, target?: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  await loadPageFonts();
  const { channel } = input;
  const [banner, logo, ...thumbs] = await Promise.all([
    bitmap(channel.banner),
    bitmap(channel.logo),
    ...channel.videos.map((_, i) => bitmap(input.thumbnails[i])),
  ]);

  const canvas = target ?? document.createElement('canvas');
  canvas.width = PAGE.outputWidth;
  canvas.height = PAGE.outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const p = palette(channel.theme);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, PAGE.width, PAGE.height);

  drawSidebar(ctx, p, channel.lang);
  drawMasthead(ctx, p, channel.lang, logo, channel);
  drawHeader(ctx, p, channel, banner, logo);
  drawCards(ctx, p, channel, thumbs);

  [banner, logo, ...thumbs].forEach((b) => b?.close());
  return canvas;
}

export async function exportChannelPage(input: ChannelPageInput): Promise<Blob> {
  const canvas = await renderChannelPage(input);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), 'image/png'));
}
