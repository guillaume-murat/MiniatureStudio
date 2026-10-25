/**
 * Google Fonts for the brand kit. Image models can't download a font, so the
 * studio loads it (Google Fonts CSS API, no key needed), renders a specimen
 * image and sends it as a typography reference along with the family name.
 */

export type FontCategory = 'display' | 'sans' | 'fun' | 'tech' | 'serif';

/** Thumbnail-friendly Google Fonts. Any other Google Fonts family can be typed in. */
export const GOOGLE_FONTS: Array<{ family: string; category: FontCategory }> = [
  ...(['Anton', 'Bebas Neue', 'Oswald', 'Archivo Black', 'Barlow Condensed', 'League Gothic', 'Teko', 'Fjalla One', 'Big Shoulders Display', 'Staatliches', 'Alfa Slab One', 'Bungee', 'Russo One', 'Rubik Mono One'] as const).map(
    (family) => ({ family, category: 'display' as const }),
  ),
  ...(['Montserrat', 'Poppins', 'Inter', 'Roboto', 'Roboto Condensed', 'Open Sans', 'Lato', 'Raleway', 'Nunito', 'Work Sans', 'DM Sans', 'Rubik', 'Archivo', 'Outfit', 'Sora', 'Kanit', 'Syne', 'Space Grotesk'] as const).map(
    (family) => ({ family, category: 'sans' as const }),
  ),
  ...(['Luckiest Guy', 'Bangers', 'Titan One', 'Lilita One', 'Righteous', 'Lobster', 'Pacifico', 'Permanent Marker', 'Caveat'] as const).map((family) => ({
    family,
    category: 'fun' as const,
  })),
  ...(['Orbitron', 'Audiowide', 'Exo 2', 'Chakra Petch', 'Black Ops One', 'Press Start 2P'] as const).map((family) => ({ family, category: 'tech' as const })),
  ...(['Playfair Display', 'DM Serif Display', 'Abril Fatface'] as const).map((family) => ({ family, category: 'serif' as const })),
];

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
  constructor(public family: string) {
    super(`"${family}" is not a Google Fonts family`);
    this.name = 'FontNotFoundError';
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

const loaded = new Map<string, Promise<{ heavy: number }>>();

/**
 * Makes the family usable in this page (regular and its heaviest weight) and
 * resolves with that weight. Rejects with FontNotFoundError for unknown names.
 */
export function loadGoogleFont(family: string): Promise<{ heavy: number }> {
  let promise = loaded.get(family);
  if (!promise) {
    promise = (async () => {
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
    })();
    loaded.set(family, promise);
    // Let a failed name be retried (network blip, typo fixed).
    promise.catch(() => loaded.delete(family));
  }
  return promise;
}

/** A 1024×512 sheet showing the typeface, sent to the image model as a typography reference. */
export async function renderFontSpecimen(family: string): Promise<Blob> {
  const { heavy } = await loadGoogleFont(family);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'alphabetic';

  const line = (text: string, weight: number, size: number, y: number) => {
    ctx.font = `${weight} ${size}px "${family}"`;
    // Shrink long lines so nothing is clipped.
    const width = ctx.measureText(text).width;
    if (width > 944) ctx.font = `${weight} ${Math.floor((size * 944) / width)}px "${family}"`;
    ctx.fillText(text, 40, y);
  };
  line(family, 400, 40, 70);
  line('THUMBNAIL 2026', heavy, 120, 210);
  line('ÉNORME ! ÇA MARCHE ?', heavy, 72, 310);
  line('Aa Bb Cc Dd Ee Ff Gg 0123456789', 400, 52, 400);
  line('The quick brown fox jumps over the lazy dog', 400, 36, 468);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
}
