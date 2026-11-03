/**
 * Text blocks and arrows drawn into an image, for good. Geometry and drawing
 * are in textBlocks.ts.
 */
import { cssFont, drawTextBlocks, isArrow, type LayerBlock, type TextBlock } from './textBlocks';
import { loadGoogleFont } from './fonts';

/** `base` with the text blocks drawn on it, at the image's own resolution. */
export async function renderText(base: Blob, blocks: LayerBlock[]): Promise<Blob> {
  // The canvas only draws with fonts the page has loaded.
  const texts = blocks.filter((b): b is TextBlock => !isArrow(b));
  await Promise.all([...new Set(texts.map((b) => b.font))].map((f) => loadGoogleFont(f).catch(() => undefined)));
  await Promise.all(texts.map((b) => document.fonts.load(cssFont(b, 48)).catch(() => undefined)));
  const bitmap = await createImageBitmap(base);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  drawTextBlocks(ctx, canvas.width, canvas.height, blocks);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
}

/** What each new version draws: the texts, then the arrows. */
export function textSteps(blocks: LayerBlock[]): LayerBlock[][] {
  return [blocks.filter((b) => !isArrow(b)), blocks.filter(isArrow)].filter((step) => step.length);
}

/** A text version's name: its texts, an arrow for each arrow. */
export function textSummary(blocks: LayerBlock[]): string {
  return blocks.map((b) => (isArrow(b) ? '➜' : b.text.replace(/\s+/g, ' ').trim())).join(' · ');
}
