/** Brand colours: hex parsing and ready-made palettes. */

export const MAX_BRAND_COLORS = 6;

const PREFIXED = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const BARE = /\b([0-9a-f]{6})\b/gi;

/** Normalises `#ABC`, `abc` or `#AABBCC` to `#aabbcc`; null if it isn't a hex colour. */
export function normaliseHex(value: string): string | null {
  const m = value.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  const hex = m[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`;
}

/**
 * Pulls every hex colour out of pasted text, whatever the separators
 * (`#FF5A1F, #111827`, one per line, CSS, a Coolors URL…). Deduplicated, in order.
 * When the text has any `#`, only `#` codes count, so words like "decade" aren't
 * read as colours; without `#` (e.g. `264653-2a9d8f`), bare 6-digit codes do.
 */
export function parseHexColors(text: string): string[] {
  const pattern = text.includes('#') ? PREFIXED : BARE;
  const found = [...text.matchAll(pattern)].map((m) => normaliseHex(m[1])).filter((c): c is string => !!c);
  return [...new Set(found)];
}

/** Adds colours to a palette, skipping duplicates, up to the limit. */
export function mergeColors(current: string[], added: string[]): string[] {
  return [...new Set([...current, ...added])].slice(0, MAX_BRAND_COLORS);
}

export type PaletteId =
  | 'neon'
  | 'sunset'
  | 'ocean'
  | 'tech'
  | 'punch'
  | 'forest'
  | 'pastel'
  | 'luxury'
  | 'gaming'
  | 'earth';

/** Ten modern brand palettes, dominant colour first. Names live in i18n (`brand.palettes.<id>`). */
export const BRAND_PALETTES: Array<{ id: PaletteId; colors: string[] }> = [
  { id: 'neon', colors: ['#7c3aed', '#22d3ee', '#f472b6', '#0b0b12'] },
  { id: 'sunset', colors: ['#ff5e3a', '#ff9f1c', '#ffd166', '#1b1b3a'] },
  { id: 'ocean', colors: ['#0a2540', '#00b4d8', '#90e0ef', '#ffffff'] },
  { id: 'tech', colors: ['#2563eb', '#10b981', '#111827', '#f9fafb'] },
  { id: 'punch', colors: ['#ffdd00', '#ff3b30', '#111111', '#ffffff'] },
  { id: 'forest', colors: ['#1b4332', '#52b788', '#d8f3dc', '#f4a261'] },
  { id: 'pastel', colors: ['#ffc8dd', '#bde0fe', '#cdb4db', '#2b2d42'] },
  { id: 'luxury', colors: ['#c9a227', '#0d0d0d', '#f5f0e1', '#7a1c1c'] },
  { id: 'gaming', colors: ['#00ff87', '#ff006e', '#3a0ca3', '#0d0221'] },
  { id: 'earth', colors: ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'] },
];
