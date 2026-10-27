/**
 * « Lisser »: fills a painted area from the colours around it, without AI.
 * Pull-push interpolation gives every masked pixel a smooth guess from its
 * surroundings at every scale, then a few relaxation passes (Laplace) remove
 * the blockiness. Deterministic and instant; right for seams and thin
 * defects on soft backgrounds, blurry on detailed areas.
 */

/**
 * Fills `rgba` (width × height, in place) where `mask` > 0, blending by the
 * mask value so soft brush edges stay soft.
 */
export function diffuseFill(rgba: Uint8ClampedArray, width: number, height: number, mask: Float32Array, relax = 60): void {
  const n = width * height;
  // Level 0: colours and weights (1 = known pixel, 0 = to fill).
  const levels: Array<{ w: number; h: number; c: Float32Array; a: Float32Array }> = [];
  const c0 = new Float32Array(n * 3);
  const a0 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const known = mask[i] > 0 ? 0 : 1;
    a0[i] = known;
    c0[i * 3] = rgba[i * 4] * known;
    c0[i * 3 + 1] = rgba[i * 4 + 1] * known;
    c0[i * 3 + 2] = rgba[i * 4 + 2] * known;
  }
  levels.push({ w: width, h: height, c: c0, a: a0 });

  // Pull: average known colours into ever coarser levels.
  while (levels[levels.length - 1].w > 1 || levels[levels.length - 1].h > 1) {
    const f = levels[levels.length - 1];
    const w = Math.ceil(f.w / 2);
    const h = Math.ceil(f.h / 2);
    const c = new Float32Array(w * h * 3);
    const a = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sa = 0;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const fx = Math.min(f.w - 1, 2 * x + dx);
            const fy = Math.min(f.h - 1, 2 * y + dy);
            const j = fy * f.w + fx;
            sa += f.a[j];
            sr += f.c[j * 3];
            sg += f.c[j * 3 + 1];
            sb += f.c[j * 3 + 2];
          }
        }
        const i = y * w + x;
        // Colours stay premultiplied by their weight; the weight saturates at 1.
        const k = sa > 1 ? 1 / sa : 1;
        a[i] = Math.min(1, sa);
        c[i * 3] = sr * k;
        c[i * 3 + 1] = sg * k;
        c[i * 3 + 2] = sb * k;
      }
    }
    levels.push({ w, h, c, a });
  }

  // Push: fill each level's gaps from the (bilinear) level above.
  for (let l = levels.length - 2; l >= 0; l--) {
    const f = levels[l];
    const g = levels[l + 1];
    for (let y = 0; y < f.h; y++) {
      const gy = Math.min(g.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
      const y0 = Math.floor(gy);
      const y1 = Math.min(g.h - 1, y0 + 1);
      const ty = gy - y0;
      for (let x = 0; x < f.w; x++) {
        const i = y * f.w + x;
        const missing = 1 - f.a[i];
        if (missing <= 0) continue;
        const gx = Math.min(g.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
        const x0 = Math.floor(gx);
        const x1 = Math.min(g.w - 1, x0 + 1);
        const tx = gx - x0;
        for (let ch = 0; ch < 3; ch++) {
          const top = g.c[(y0 * g.w + x0) * 3 + ch] * (1 - tx) + g.c[(y0 * g.w + x1) * 3 + ch] * tx;
          const bottom = g.c[(y1 * g.w + x0) * 3 + ch] * (1 - tx) + g.c[(y1 * g.w + x1) * 3 + ch] * tx;
          f.c[i * 3 + ch] += missing * (top * (1 - ty) + bottom * ty);
        }
        f.a[i] = 1;
      }
    }
  }

  // Relax: each filled pixel becomes the mean of its neighbours, known pixels stay fixed.
  const filled: number[] = [];
  for (let i = 0; i < n; i++) if (mask[i] > 0) filled.push(i);
  const c = levels[0].c;
  for (let pass = 0; pass < relax; pass++) {
    for (const i of filled) {
      const x = i % width;
      const y = (i - x) / width;
      const l = x > 0 ? i - 1 : i;
      const r = x < width - 1 ? i + 1 : i;
      const u = y > 0 ? i - width : i;
      const d = y < height - 1 ? i + width : i;
      for (let ch = 0; ch < 3; ch++) c[i * 3 + ch] = (c[l * 3 + ch] + c[r * 3 + ch] + c[u * 3 + ch] + c[d * 3 + ch]) / 4;
    }
  }

  for (const i of filled) {
    const m = Math.min(1, mask[i]);
    for (let ch = 0; ch < 3; ch++) rgba[i * 4 + ch] = rgba[i * 4 + ch] * (1 - m) + c[i * 3 + ch] * m;
  }
}

/** « Lisser » on a whole image: the painted `mask` (any opacity) is refilled from its surroundings. */
export async function smoothRegion(image: Blob, mask: HTMLCanvasElement): Promise<Blob> {
  const bmp = await createImageBitmap(image);
  const { width, height } = bmp;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const pixels = ctx.getImageData(0, 0, width, height);

  const m = document.createElement('canvas');
  m.width = width;
  m.height = height;
  const mctx = m.getContext('2d', { willReadFrequently: true })!;
  mctx.drawImage(mask, 0, 0, width, height);
  const alpha = mctx.getImageData(0, 0, width, height).data;
  // The brush paints translucent: any coverage counts as fully painted, except the soft rim.
  const weights = new Float32Array(width * height);
  let max = 0;
  for (let i = 0; i < weights.length; i++) max = Math.max(max, alpha[i * 4 + 3]);
  for (let i = 0; i < weights.length; i++) weights[i] = max ? Math.min(1, alpha[i * 4 + 3] / max) : 0;

  diffuseFill(pixels.data, width, height, weights);
  ctx.putImageData(pixels, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
}
