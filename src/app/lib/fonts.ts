/**
 * Google Fonts for the text tool: bundled files for the curated list, the
 * Google Fonts CSS API for any other family.
 */

type FontCategory = 'display' | 'sans' | 'fun' | 'tech' | 'serif';

interface GoogleFont {
  family: string;
  category: FontCategory;
  /** Heaviest weight Google Fonts has for the family (400 when it has a single weight). */
  heavy: number;
}

/**
 * Thumbnail-friendly Google Fonts, shipped with the app in public/fonts (latin
 * subset, regular and heaviest weight; `npm run fonts:download`). Any other
 * Google Fonts family can be typed in and is then loaded from Google.
 */
export const GOOGLE_FONTS: GoogleFont[] = [
  { family: 'Anton', category: 'display', heavy: 400 },
  { family: 'Bebas Neue', category: 'display', heavy: 400 },
  { family: 'Oswald', category: 'display', heavy: 700 },
  { family: 'Archivo Black', category: 'display', heavy: 400 },
  { family: 'Barlow Condensed', category: 'display', heavy: 900 },
  { family: 'League Gothic', category: 'display', heavy: 400 },
  { family: 'Teko', category: 'display', heavy: 700 },
  { family: 'Fjalla One', category: 'display', heavy: 400 },
  { family: 'Big Shoulders Display', category: 'display', heavy: 900 },
  { family: 'Staatliches', category: 'display', heavy: 400 },
  { family: 'Alfa Slab One', category: 'display', heavy: 400 },
  { family: 'Bungee', category: 'display', heavy: 400 },
  { family: 'Russo One', category: 'display', heavy: 400 },
  { family: 'Rubik Mono One', category: 'display', heavy: 400 },
  { family: 'Montserrat', category: 'sans', heavy: 900 },
  { family: 'Poppins', category: 'sans', heavy: 900 },
  { family: 'Inter', category: 'sans', heavy: 900 },
  { family: 'Roboto', category: 'sans', heavy: 900 },
  { family: 'Roboto Condensed', category: 'sans', heavy: 900 },
  { family: 'Open Sans', category: 'sans', heavy: 800 },
  { family: 'Lato', category: 'sans', heavy: 900 },
  { family: 'Raleway', category: 'sans', heavy: 900 },
  { family: 'Nunito', category: 'sans', heavy: 900 },
  { family: 'Work Sans', category: 'sans', heavy: 900 },
  { family: 'DM Sans', category: 'sans', heavy: 900 },
  { family: 'Rubik', category: 'sans', heavy: 900 },
  { family: 'Archivo', category: 'sans', heavy: 900 },
  { family: 'Outfit', category: 'sans', heavy: 900 },
  { family: 'Sora', category: 'sans', heavy: 800 },
  { family: 'Kanit', category: 'sans', heavy: 900 },
  { family: 'Syne', category: 'sans', heavy: 800 },
  { family: 'Space Grotesk', category: 'sans', heavy: 700 },
  { family: 'Bricolage Grotesque', category: 'sans', heavy: 800 },
  { family: 'Luckiest Guy', category: 'fun', heavy: 400 },
  { family: 'Bangers', category: 'fun', heavy: 400 },
  { family: 'Titan One', category: 'fun', heavy: 400 },
  { family: 'Lilita One', category: 'fun', heavy: 400 },
  { family: 'Righteous', category: 'fun', heavy: 400 },
  { family: 'Lobster', category: 'fun', heavy: 400 },
  { family: 'Pacifico', category: 'fun', heavy: 400 },
  { family: 'Permanent Marker', category: 'fun', heavy: 400 },
  { family: 'Caveat', category: 'fun', heavy: 700 },
  { family: 'Orbitron', category: 'tech', heavy: 900 },
  { family: 'Audiowide', category: 'tech', heavy: 400 },
  { family: 'Exo 2', category: 'tech', heavy: 900 },
  { family: 'Chakra Petch', category: 'tech', heavy: 700 },
  { family: 'Black Ops One', category: 'tech', heavy: 400 },
  { family: 'Press Start 2P', category: 'tech', heavy: 400 },
  { family: 'Playfair Display', category: 'serif', heavy: 900 },
  { family: 'DM Serif Display', category: 'serif', heavy: 400 },
  { family: 'Abril Fatface', category: 'serif', heavy: 400 },
];

/** Path of a bundled font file, relative to the site root: fonts/bebas-neue-400.woff2. */
export function localFontFile(family: string, weight: number): string {
  return `fonts/${family.toLowerCase().replace(/ /g, '-')}-${weight}.woff2`;
}

/** The weights shipped for a bundled family: regular, and the heaviest when different. */
export function bundledWeights(font: GoogleFont): number[] {
  return [...new Set([400, font.heavy])];
}

export const FONT_CATEGORIES: FontCategory[] = ['display', 'sans', 'fun', 'tech', 'serif'];

/** Google Fonts family names are letters, digits and single spaces. */
export function normaliseFamily(name: string): string | null {
  const family = name.trim().replace(/\s+/g, ' ');
  return /^[A-Za-z0-9][A-Za-z0-9 ]{0,59}$/.test(family) ? family : null;
}

export function fontCssUrl(family: string, weight?: number): string {
  const name = encodeURIComponent(family).replace(/%20/g, '+');
  return `https://fonts.googleapis.com/css2?family=${name}${weight ? `:wght@${weight}` : ''}&display=swap`;
}

export class FontNotFoundError extends Error {
  family: string;
  constructor(family: string) {
    super(`"${family}" is not a Google Fonts family`);
    this.name = 'FontNotFoundError';
    this.family = family;
  }
}

/**
 * CSS for a family/weight, or null when Google Fonts doesn't have it. Its 400
 * errors carry no CORS header, so the browser reports them as network errors:
 * those count as "not available" unless the device is offline.
 */
async function fetchCss(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.text() : null;
  } catch (error) {
    if (!navigator.onLine) throw error;
    return null;
  }
}

export function findBundledFont(family: string): GoogleFont | undefined {
  const name = family.toLowerCase();
  return GOOGLE_FONTS.find((f) => f.family.toLowerCase() === name);
}

const faces = new Map<string, Promise<void>>();

/** Registers one bundled weight with the page (FontFace API, no network outside the site). */
function loadBundledFace(family: string, weight: number): Promise<void> {
  const key = `${family}|${weight}`;
  let promise = faces.get(key);
  if (!promise) {
    const face = new FontFace(family, `url(${import.meta.env.BASE_URL}${localFontFile(family, weight)})`, { weight: String(weight) });
    document.fonts.add(face);
    promise = face.load().then(() => undefined);
    faces.set(key, promise);
    promise.catch(() => faces.delete(key));
  }
  return promise;
}

/** Regular weight of a listed family, to show its name in its own typeface. */
export function loadFontPreview(family: string): Promise<void> {
  return findBundledFont(family) ? loadBundledFace(family, 400) : Promise.resolve();
}

const loaded = new Map<string, Promise<{ heavy: number }>>();

/**
 * Makes the family usable in this page (regular and its heaviest weight) and
 * resolves with that weight. Listed families come from the bundled files;
 * others from Google, rejecting with FontNotFoundError for unknown names.
 */
export function loadGoogleFont(family: string): Promise<{ heavy: number }> {
  let promise = loaded.get(family);
  if (!promise) {
    const bundled = findBundledFont(family);
    promise = bundled
      ? Promise.all(bundledWeights(bundled).map((w) => loadBundledFace(bundled.family, w))).then(() => ({ heavy: bundled.heavy }))
      : loadRemoteFont(family);
    loaded.set(family, promise);
    // Let a failed name be retried (network blip, typo fixed).
    promise.catch(() => loaded.delete(family));
  }
  return promise;
}

async function loadRemoteFont(family: string): Promise<{ heavy: number }> {
  const regular = await fetchCss(fontCssUrl(family));
  if (!regular) throw new FontNotFoundError(family);
  let heavy = 400;
  let heavyCss = '';
  for (const weight of [900, 800, 700]) {
    const css = await fetchCss(fontCssUrl(family, weight));
    if (css) {
      heavy = weight;
      heavyCss = css;
      break;
    }
  }
  const style = document.createElement('style');
  style.dataset.googleFont = family;
  style.textContent = regular + heavyCss;
  document.head.append(style);
  await Promise.all([document.fonts.load(`400 48px "${family}"`), document.fonts.load(`${heavy} 48px "${family}"`)]);
  return { heavy };
}
