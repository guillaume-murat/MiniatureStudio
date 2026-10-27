import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEED, formatAgo, formatCount, formatDuration, parseIsoDuration, shuffled } from '../feedVideos';

describe('formatting', () => {
  it('reads ISO durations and writes YouTube badges', () => {
    expect(parseIsoDuration('PT4M17S')).toBe(257);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('PT31S')).toBe(31);
    expect(formatDuration(257)).toBe('4:17');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
  it('compacts view counts per language', () => {
    expect(formatCount(1945646, 'fr').replace(/\s/g, ' ')).toBe('1,9 M');
    expect(formatCount(308827, 'en')).toBe('308.8K');
  });
  it('says how long ago', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(formatAgo('2026-10-24T12:00:00Z', 'fr', now)).toBe('il y a 3 jours');
    expect(formatAgo('2026-10-27T09:00:00Z', 'en', now)).toBe('3 hours ago');
  });
});

describe('shuffled', () => {
  it('is a stable permutation for a seed', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    expect(shuffled(items, 42)).toEqual(shuffled(items, 42));
    expect(shuffled(items, 42)).not.toEqual(shuffled(items, 43));
    expect([...shuffled(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });
});

describe('bundled feed videos', () => {
  it('ships 30 regular videos with their images', () => {
    expect(FEED.videos).toHaveLength(30);
    for (const v of FEED.videos) {
      expect(v.title).toBeTruthy();
      expect(v.duration).toBeGreaterThan(60);
      expect(existsSync(`public/${v.thumbnail}`), v.thumbnail).toBe(true);
      if (v.channelLogo) expect(existsSync(`public/${v.channelLogo}`), v.channelLogo).toBe(true);
    }
  });
});
