/**
 * Downloads the curated brand-kit fonts (src/app/lib/fonts.ts) into public/fonts:
 * the latin subset (covers French accents) of the regular and heaviest weight.
 * Existing files are kept; pass --force to fetch them again.
 *
 *   npm run fonts:download
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { bundledWeights, fontCssUrl, GOOGLE_FONTS, localFontFile } from '../src/app/lib/fonts.ts';

// Google Fonts only serves woff2 to browsers it recognises.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const force = process.argv.includes('--force');

await mkdir('public/fonts', { recursive: true });
let downloaded = 0;

for (const font of GOOGLE_FONTS) {
  for (const weight of bundledWeights(font)) {
    const target = `public/${localFontFile(font.family, weight)}`;
    if (!force && existsSync(target)) continue;

    const css = await fetch(fontCssUrl(font.family, weight === 400 ? undefined : weight), { headers: { 'User-Agent': UA } });
    if (!css.ok) throw new Error(`${font.family} ${weight}: CSS ${css.status}`);
    const latin = (await css.text()).split('/* latin */')[1];
    const url = latin?.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) throw new Error(`${font.family} ${weight}: no latin woff2`);

    const file = await fetch(url);
    if (!file.ok) throw new Error(`${font.family} ${weight}: font ${file.status}`);
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    downloaded++;
    console.log(`✓ ${target}`);
  }
}
console.log(`${downloaded} file(s) downloaded, ${GOOGLE_FONTS.length} families.`);
