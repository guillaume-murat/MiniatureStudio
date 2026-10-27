import { describe, expect, it } from 'vitest';
import {
  compactNumber,
  ellipsis,
  fillSlots,
  formatAge,
  formatDuration,
  formatSubscribers,
  formatVideoCount,
  formatViews,
  initials,
  mulberry32,
  normaliseHandle,
  videoStats,
  VIEWS_MAX,
  VIEWS_MIN,
  wrapText,
} from '../channel';

const NBSP = ' ';
/** Monospace stand-in for canvas measureText: 10 px per character. */
const measure = (s: string) => [...s].length * 10;

describe('videoStats', () => {
  it('is stable for a seed and changes with it', () => {
    expect(videoStats(42)).toEqual(videoStats(42));
    expect(videoStats(42)).not.toEqual(videoStats(43));
  });

  it('gives six plausible videos, newest first', () => {
    for (const seed of [1, 7, 123456, 2 ** 31 - 1]) {
      const stats = videoStats(seed);
      expect(stats).toHaveLength(6);
      expect(stats[0].ageHours).toBeLessThanOrEqual(6 * 24);
      for (let i = 1; i < stats.length; i++) expect(stats[i].ageHours).toBeGreaterThan(stats[i - 1].ageHours);
      for (const s of stats) {
        expect(s.durationSec).toBeGreaterThanOrEqual(4 * 60);
        expect(s.durationSec).toBeLessThanOrEqual(95 * 60);
        expect(s.views).toBeGreaterThanOrEqual(VIEWS_MIN);
        expect(s.views).toBeLessThanOrEqual(VIEWS_MAX);
      }
    }
  });

  it('keeps every view count between 50K and 500K, spread over the range', () => {
    const views = Array.from({ length: 200 }, (_, seed) => videoStats(seed)).flat().map((s) => s.views);
    expect(Math.min(...views)).toBeGreaterThanOrEqual(50_000);
    expect(Math.max(...views)).toBeLessThanOrEqual(500_000);
    expect(views.some((v) => v < 100_000)).toBe(true);
    expect(views.some((v) => v > 300_000)).toBe(true);
  });

  it('draws numbers in [0, 1)', () => {
    const rand = mulberry32(9);
    for (let i = 0; i < 1000; i++) {
      const x = rand();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('YouTube number formats', () => {
  it('truncates like YouTube, in French and English', () => {
    expect(compactNumber(856, 'fr')).toBe('856');
    expect(compactNumber(1499, 'fr')).toBe(`1,4${NBSP}k`);
    expect(compactNumber(1000, 'en')).toBe('1K');
    expect(compactNumber(142_900, 'fr')).toBe(`142${NBSP}k`);
    expect(compactNumber(142_900, 'en')).toBe('142K');
    expect(compactNumber(2_480_000, 'fr')).toBe(`2,4${NBSP}M`);
    expect(compactNumber(2_480_000, 'en')).toBe('2.4M');
    expect(compactNumber(34_000_000, 'en')).toBe('34M');
  });

  it('writes views, subscribers and video counts', () => {
    expect(formatViews(142_000, 'fr')).toBe(`142${NBSP}k vues`);
    expect(formatViews(2_400_000, 'fr')).toBe(`2,4${NBSP}M de vues`);
    expect(formatViews(1, 'fr')).toBe('1 vue');
    expect(formatViews(84_000, 'en')).toBe('84K views');
    expect(formatSubscribers(847_000, 'fr')).toBe(`847${NBSP}k abonnés`);
    expect(formatSubscribers(1_200_000, 'fr')).toBe(`1,2${NBSP}M d'abonnés`);
    expect(formatSubscribers(847_000, 'en')).toBe('847K subscribers');
    expect(formatVideoCount(1400, 'fr')).toBe(`1,4${NBSP}k vidéos`);
    expect(formatVideoCount(1, 'en')).toBe('1 video');
  });

  it('writes upload ages in YouTube units', () => {
    expect(formatAge(5, 'fr')).toBe('il y a 5 heures');
    expect(formatAge(24, 'fr')).toBe('il y a 1 jour');
    expect(formatAge(72, 'fr')).toBe('il y a 3 jours');
    expect(formatAge(24 * 15, 'fr')).toBe('il y a 2 semaines');
    expect(formatAge(24 * 65, 'fr')).toBe('il y a 2 mois');
    expect(formatAge(24 * 800, 'fr')).toBe('il y a 2 ans');
    expect(formatAge(1, 'en')).toBe('1 hour ago');
    expect(formatAge(24 * 35, 'en')).toBe('1 month ago');
  });

  it('writes durations', () => {
    expect(formatDuration(2137)).toBe('35:37');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
});

describe('channel identity', () => {
  it('normalises handles', () => {
    expect(normaliseHandle('Ma Chaîne')).toBe('@MaChaîne');
    expect(normaliseHandle('@@lorem_ipsum!')).toBe('@lorem_ipsum');
    expect(normaliseHandle('   ')).toBe('');
  });

  it('makes logo initials', () => {
    expect(initials('Lorem Ipsum Dolor')).toBe('LI');
    expect(initials('vlog')).toBe('VL');
    expect(initials('')).toBe('?');
  });
});

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText('Hello world', 200, 2, measure)).toEqual(['Hello world']);
  });

  it('wraps on words', () => {
    expect(wrapText('aaaa bbbb cccc', 90, 2, measure)).toEqual(['aaaa bbbb', 'cccc']);
  });

  it('ellipsises the last line when the text overflows', () => {
    const lines = wrapText('aaaa bbbb cccc dddd eeee', 90, 2, measure);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(90);
  });

  it('cuts a single word wider than the line', () => {
    const [line] = wrapText('abcdefghijklmnop', 50, 2, measure);
    expect(line.endsWith('…')).toBe(true);
    expect(measure(line)).toBeLessThanOrEqual(50);
  });

  it('ellipsis leaves fitting text untouched', () => {
    expect(ellipsis('abc', 100, measure)).toBe('abc');
    expect(ellipsis('abcdefghij', 50, measure)).toBe('abcd…');
  });
});

describe('fillSlots', () => {
  const v = (id: string, thumbnail = id) => ({ id, thumbnail });

  it('keeps placed versions and fills the rest in order', () => {
    expect(fillSlots([undefined, v('b2', 'b')], [v('a'), v('b3', 'b'), v('c')], 4)).toEqual(['a', 'b2', 'c', undefined]);
  });

  it('never shows the same thumbnail twice', () => {
    expect(fillSlots([], [v('a1', 'a'), v('a2', 'a'), v('b')], 3)).toEqual(['a1', 'b', undefined]);
  });
});
