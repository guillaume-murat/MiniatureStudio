import type { ModelId, Resolution } from './types';

/**
 * Google's standard price per image, in dollars (Gemini API price list, checked in November 2026).
 * Indicative with the other providers. Lite only exists in 1K.
 */
const IMAGE_PRICES: Record<ModelId, Partial<Record<Resolution, number>>> = {
  'nano-banana-pro': { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
  'nano-banana-2': { '1K': 0.067, '2K': 0.101, '4K': 0.151 },
  'nano-banana-2-lite': { '1K': 0.034 },
};

/** « 0,067 $ », "$0.067"; the price at 1K for a model without that resolution. */
export function imagePrice(model: ModelId, resolution: Resolution, lang: 'en' | 'fr'): string {
  const price = IMAGE_PRICES[model][resolution] ?? IMAGE_PRICES[model]['1K']!;
  return lang === 'fr' ? `${String(price).replace('.', ',')} $` : `$${price}`;
}
