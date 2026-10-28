/** Language of the mock-up's interface strings (the studio's language). */
export type MockLang = 'fr' | 'en';

/**
 * Pure helpers for the channel page mock-up (ported from NanoChannel): seeded video statistics and the
 * YouTube-style formatting of counts, ages and durations (fr / en).
 */

export const VIDEO_SLOTS = 6;

/** Range of the random view counts shown under each video. */
export const VIEWS_MIN = 50_000;
export const VIEWS_MAX = 500_000;

interface VideoStats {
  views: number;
  durationSec: number;
  /** Time since upload; increases from one video to the next ("Latest" order). */
  ageHours: number;
}

/** Small deterministic PRNG: the same seed always gives the same mock-up. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Plausible stats for `count` videos, newest first. */
export function videoStats(seed: number, count = VIDEO_SLOTS): VideoStats[] {
  const rand = mulberry32(seed);
  const stats: VideoStats[] = [];
  let age = 0;
  for (let i = 0; i < count; i++) {
    // Newest: a few hours to 6 days old; then one upload every 2 to 14 days.
    age = i === 0 ? 3 + rand() * 141 : age + 24 * (2 + rand() * 12);
    // Log-uniform: as many videos around 70K as around 350K.
    const views = Math.round(VIEWS_MIN * (VIEWS_MAX / VIEWS_MIN) ** rand());
    // 4 to 40 minutes, sometimes a long-form video.
    const minutes = rand() < 0.12 ? 45 + rand() * 50 : 4 + rand() * 36;
    stats.push({ views, durationSec: Math.round(minutes * 60), ageHours: Math.round(age) });
  }
  return stats;
}

const NBSP = ' ';

/** YouTube's compact numbers, truncated rather than rounded: 1,4 k / 142 k / 2,4 M (fr), 1.4K / 142K / 2.4M (en). */
export function compactNumber(n: number, lang: MockLang): string {
  const value = Math.max(0, Math.floor(n));
  const sep = lang === 'fr' ? NBSP : '';
  const decimal = (x: number) => {
    const s = (Math.floor(x * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return lang === 'fr' ? s.replace('.', ',') : s;
  };
  if (value < 1000) return String(value);
  if (value < 10_000) return `${decimal(value / 1000)}${sep}${lang === 'fr' ? 'k' : 'K'}`;
  if (value < 1_000_000) return `${Math.floor(value / 1000)}${sep}${lang === 'fr' ? 'k' : 'K'}`;
  if (value < 10_000_000) return `${decimal(value / 1_000_000)}${sep}M`;
  if (value < 1_000_000_000) return `${Math.floor(value / 1_000_000)}${sep}M`;
  return `${decimal(value / 1_000_000_000)}${sep}${lang === 'fr' ? 'Md' : 'B'}`;
}

/** French uses "de" after millions: "2,4 M de vues" but "142 k vues". */
function countWith(n: number, lang: MockLang, one: string, many: string): string {
  const compact = compactNumber(n, lang);
  if (lang === 'fr') {
    if (n < 2) return `${compact} ${one}`;
    return n >= 1_000_000 ? `${compact} ${/^[aeiouéh]/i.test(many) ? "d'" : 'de '}${many}` : `${compact} ${many}`;
  }
  return `${compact} ${n === 1 ? one : many}`;
}

export function formatViews(n: number, lang: MockLang): string {
  return lang === 'fr' ? countWith(n, lang, 'vue', 'vues') : countWith(n, lang, 'view', 'views');
}

export function formatSubscribers(n: number, lang: MockLang): string {
  return lang === 'fr' ? countWith(n, lang, 'abonné', 'abonnés') : countWith(n, lang, 'subscriber', 'subscribers');
}

export function formatVideoCount(n: number, lang: MockLang): string {
  return lang === 'fr' ? countWith(n, lang, 'vidéo', 'vidéos') : countWith(n, lang, 'video', 'videos');
}

/** "il y a 3 jours" / "3 days ago", in YouTube's units. */
export function formatAge(hours: number, lang: MockLang): string {
  const h = Math.max(1, Math.floor(hours));
  const days = Math.floor(h / 24);
  let n: number;
  let unit: 'hour' | 'day' | 'week' | 'month' | 'year';
  if (days < 1) [n, unit] = [h, 'hour'];
  else if (days < 7) [n, unit] = [days, 'day'];
  else if (days < 30) [n, unit] = [Math.floor(days / 7), 'week'];
  else if (days < 365) [n, unit] = [Math.floor(days / 30), 'month'];
  else [n, unit] = [Math.floor(days / 365), 'year'];

  if (lang === 'fr') {
    const fr = { hour: 'heure', day: 'jour', week: 'semaine', month: 'mois', year: 'an' }[unit];
    return `il y a ${n} ${n > 1 && unit !== 'month' ? `${fr}s` : fr}`;
  }
  return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
}

/** 35:07 or 1:02:03. */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** "@MaChaîne" from whatever the user typed (or the channel name). */
export function normaliseHandle(text: string): string {
  const core = text.trim().replace(/^@+/, '').replace(/\s+/g, '').replace(/[^\p{L}\p{N}._-]/gu, '');
  return core ? `@${core}` : '';
}

/** Up to two initials for the logo placeholder. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]];
  return letters.join('').toUpperCase();
}

/** Text lines for `text` in at most `maxLines`, the last one ellipsised if it overflows. */
export function wrapText(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let i = 0;
  for (; i < words.length; i++) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (measure(candidate) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
    current = '';
    i = words.length;
  }
  const overflow = i < words.length || !!current;
  const last = lines.length - 1;
  if (last >= 0 && (overflow || measure(lines[last]) > maxWidth)) {
    lines[last] = ellipsis(overflow ? `${lines[last]} ` : lines[last], maxWidth, measure, overflow);
  }
  return lines;
}

/** Cut `text` so that it plus "…" fits in `maxWidth`. `force`: always end with "…". */
export function ellipsis(text: string, maxWidth: number, measure: (s: string) => number, force = false): string {
  const trimmed = text.trimEnd();
  if (!force && measure(trimmed) <= maxWidth) return trimmed;
  const chars = [...trimmed];
  while (chars.length && measure(`${chars.join('').trimEnd()}…`) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/** A version that can go in a video slot; `thumbnail` groups the versions of one image. */
interface SlotCandidate {
  id: string;
  thumbnail: string;
}

/**
 * The version shown in each video: the ones the user placed stay, the empty
 * slots take the candidates in order (the selected thumbnail first), never
 * showing the same thumbnail twice.
 */
export function fillSlots(placed: Array<SlotCandidate | undefined>, candidates: SlotCandidate[], count = VIDEO_SLOTS): Array<string | undefined> {
  const used = new Set(placed.filter((p): p is SlotCandidate => !!p).map((p) => p.thumbnail));
  const queue = candidates.filter((c) => !used.has(c.thumbnail) && (used.add(c.thumbnail), true));
  return Array.from({ length: count }, (_, i) => placed[i]?.id ?? queue.shift()?.id);
}
