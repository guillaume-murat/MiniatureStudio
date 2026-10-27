import { describe, expect, it } from 'vitest';
import { channelLayout, coverCrop, PAGE, SCALE, type Rect } from '../channelLayout';

const inside = (r: Rect, box: Rect) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const page = { x: 0, y: 0, w: PAGE.width, h: PAGE.height };

describe('channelLayout', () => {
  const layout = channelLayout();

  it('exports at exactly 2560×1440', () => {
    expect(PAGE.width * SCALE).toBe(2560);
    expect(PAGE.height * SCALE).toBe(1440);
  });

  it('lays out a 3×2 grid of 16:9 cards inside the content column', () => {
    expect(layout.cards).toHaveLength(6);
    for (const card of layout.cards) {
      expect(inside(card.thumb, layout.content)).toBe(true);
      expect(card.thumb.w / card.thumb.h).toBeCloseTo(16 / 9, 1);
    }
    expect(new Set(layout.cards.map((c) => c.thumb.y)).size).toBe(2);
    expect(new Set(layout.cards.map((c) => c.thumb.x)).size).toBe(3);
  });

  it('keeps cards, titles and the two-line stats of the second row on the page', () => {
    for (const card of layout.cards) {
      const lastStats = card.title.y + 16 + card.titleLineHeight + card.statsGap;
      expect(lastStats).toBeLessThanOrEqual(PAGE.height - 4);
      expect(inside(card.title, page)).toBe(true);
    }
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) expect(overlaps(layout.cards[i].thumb, layout.cards[j].thumb)).toBe(false);
  });

  it('stacks banner, header, tabs, chips and grid without overlap', () => {
    expect(layout.banner.y).toBeGreaterThanOrEqual(layout.masthead.h);
    expect(layout.avatar.y).toBeGreaterThan(layout.banner.y + layout.banner.h);
    expect(layout.tabs.y).toBeGreaterThan(layout.avatar.y + layout.avatar.h);
    expect(layout.chips.y).toBeGreaterThan(layout.tabs.y + layout.tabs.height);
    expect(layout.cards[0].thumb.y).toBeGreaterThan(layout.chips.y + layout.chips.height);
    expect(layout.info.buttonsY + layout.info.buttonHeight).toBeLessThan(layout.tabs.y);
    expect(layout.content.x).toBeGreaterThanOrEqual(layout.sidebar.w);
  });
});

describe('coverCrop', () => {
  it('crops a 4:3 image to fill a 16:9 card, centred', () => {
    const r = coverCrop(1200, 900, { w: 1600, h: 900 });
    expect(r.w).toBe(1200);
    expect(r.h).toBeCloseTo(675);
    expect(r.y).toBeCloseTo(112.5);
  });

  it('crops a wide banner from the sides', () => {
    const r = coverCrop(2560, 1440, { w: 1104, h: 176 });
    expect(r.w / r.h).toBeCloseTo(1104 / 176);
    expect(r.x).toBe(0);
  });

  it('keeps the cover crop inside the image (WebKit draws nothing otherwise)', () => {
    // 138 / (138 / 240) is 240.00000000000003 in floating point.
    const r = coverCrop(240, 240, { w: 138, h: 138 });
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(240);
    expect(r.y + r.h).toBeLessThanOrEqual(240);
  });
});
