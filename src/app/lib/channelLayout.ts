/**
 * Geometry of the channel page mock-up (YouTube desktop, Videos tab), in CSS
 * pixels of a 1920×1080 viewport. The renderer draws at `PAGE.scale`, so the
 * export is exactly 2560×1440. Pure: no DOM, covered by tests.
 */

export const PAGE = { width: 1920, height: 1080, outputWidth: 2560, outputHeight: 1440 } as const;
export const SCALE = PAGE.outputWidth / PAGE.width;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardLayout {
  thumb: Rect;
  /** Title block: up to two lines, the ⋮ menu sits at its right. */
  title: Rect;
  titleLineHeight: number;
  /** Baseline offset of the stats line below the last title line. */
  statsGap: number;
  menu: Rect;
}

export interface ChannelLayout {
  masthead: Rect;
  sidebar: Rect;
  sidebarItemHeight: number;
  content: Rect;
  banner: Rect;
  avatar: Rect;
  /** Name, handle line, description, links, buttons: left edge and baselines. */
  info: { x: number; nameY: number; metaY: number; descY: number; linksY: number; buttonsY: number; buttonHeight: number; maxWidth: number };
  tabs: { y: number; height: number };
  chips: { y: number; height: number };
  cards: CardLayout[];
}

const SIDEBAR_WIDTH = 240;
const CONTENT_WIDTH = 1104;
const COLUMNS = 3;
const GAP = 16;
const ROW_PITCH = 278;

export function channelLayout(): ChannelLayout {
  const masthead = { x: 0, y: 0, w: PAGE.width, h: 56 };
  const sidebar = { x: 0, y: masthead.h, w: SIDEBAR_WIDTH, h: PAGE.height - masthead.h };
  const x = SIDEBAR_WIDTH + Math.round((PAGE.width - SIDEBAR_WIDTH - CONTENT_WIDTH) / 2);
  const content = { x, y: masthead.h, w: CONTENT_WIDTH, h: PAGE.height - masthead.h };

  const banner = { x, y: 60, w: CONTENT_WIDTH, h: 176 };
  const avatar = { x, y: banner.y + banner.h + 28, w: 138, h: 138 };
  const infoX = avatar.x + avatar.w + 24;
  const info = {
    x: infoX,
    nameY: banner.y + banner.h + 46,
    metaY: banner.y + banner.h + 70,
    descY: banner.y + banner.h + 97,
    linksY: banner.y + banner.h + 124,
    buttonsY: banner.y + banner.h + 134,
    buttonHeight: 36,
    maxWidth: x + CONTENT_WIDTH - infoX,
  };
  const tabs = { y: avatar.y + avatar.h + 10, height: 46 };
  const chips = { y: tabs.y + tabs.height + 14, height: 32 };

  const cardWidth = (CONTENT_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS;
  const thumbHeight = Math.round((cardWidth * 9) / 16);
  const gridY = chips.y + chips.height + 18;
  const cards: CardLayout[] = [];
  for (let i = 0; i < 6; i++) {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    const thumb = { x: x + col * (cardWidth + GAP), y: gridY + row * ROW_PITCH, w: cardWidth, h: thumbHeight };
    cards.push({
      thumb,
      title: { x: thumb.x, y: thumb.y + thumbHeight + 10, w: cardWidth - 32, h: 44 },
      titleLineHeight: 22,
      statsGap: 21,
      menu: { x: thumb.x + cardWidth - 24, y: thumb.y + thumbHeight + 10, w: 24, h: 24 },
    });
  }

  return { masthead, sidebar, sidebarItemHeight: 40, content, banner, avatar, info, tabs, chips, cards };
}

/**
 * Cover-fit: the source rectangle of an image of `w`×`h` that fills `target` without distortion.
 * Kept inside the image: WebKit draws nothing when the source overflows it, even by a rounding error.
 */
export function coverCrop(w: number, h: number, target: { w: number; h: number }): Rect {
  const scale = Math.max(target.w / w, target.h / h);
  const sw = Math.min(w, target.w / scale);
  const sh = Math.min(h, target.h / scale);
  return { x: Math.max(0, (w - sw) / 2), y: Math.max(0, (h - sh) / 2), w: sw, h: sh };
}
