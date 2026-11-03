/**
 * The editable text layer of a version: text blocks and arrows drawn over a
 * base image (`Generation.textLayer`). Geometry and drawing are in textBlocks.ts.
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

/**
 * The versions that applying `blocks` over a layer adds: one for the new texts,
 * then one for the new arrows, each holding the layer as it stands at that step.
 * None when nothing is new (changes to existing blocks stay in their version).
 */
export function layerSteps(previous: LayerBlock[], blocks: LayerBlock[]): Array<{ added: LayerBlock[]; blocks: LayerBlock[] }> {
  const known = new Set(previous.map((b) => b.id));
  const added = blocks.filter((b) => !known.has(b.id));
  const groups = [added.filter((b) => !isArrow(b)), added.filter(isArrow)].filter((group) => group.length);
  const shown = new Set(known);
  return groups.map((group) => {
    group.forEach((b) => shown.add(b.id));
    return { added: group, blocks: blocks.filter((b) => shown.has(b.id)) };
  });
}

/** A text version's name: its texts, an arrow for each arrow. */
export function textSummary(blocks: LayerBlock[]): string {
  return blocks.map((b) => (isArrow(b) ? '➜' : b.text.replace(/\s+/g, ' ').trim())).join(' · ');
}
