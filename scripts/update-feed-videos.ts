/**
 * Bundles 30 real YouTube videos for the feed preview: their details go to
 * src/app/data/feed-videos.json and their thumbnails (640×360) and channel
 * logos to public/feed/, so the app shows them with no key and no call.
 *
 *   npm run feed:update            # France
 *   npm run feed:update -- US      # another region
 *
 * Needs a YouTube Data API v3 key: YOUTUBE_API_KEY, or else the gcloud project's
 * key named "NanoThumbnail YouTube…" (never printed). Uses macOS `sips` to resize.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { parseIsoDuration } from '../src/app/lib/feedFormat.ts';

const COUNT = 30;
const OUT_JSON = 'src/app/data/feed-videos.json';
const OUT_DIR = 'public/feed';
const API = 'https://www.googleapis.com/youtube/v3';
const region = (process.argv[2] || 'FR').toUpperCase();
const lang = region === 'FR' ? 'fr' : 'en';

function apiKey(): string {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  const keys = JSON.parse(execFileSync('gcloud', ['services', 'api-keys', 'list', '--format=json'], { encoding: 'utf8' })) as Array<{
    name: string;
    displayName?: string;
  }>;
  const key = keys.find((k) => k.displayName?.startsWith('NanoThumbnail YouTube'));
  if (!key) throw new Error('No YOUTUBE_API_KEY and no gcloud key named "NanoThumbnail YouTube…".');
  return execFileSync('gcloud', ['services', 'api-keys', 'get-key-string', key.name, '--format=value(keyString)'], { encoding: 'utf8' }).trim();
}

async function call<T>(path: string, key: string): Promise<T> {
  // The key goes in a header, never in the URL.
  const res = await fetch(`${API}/${path}`, { headers: { 'X-Goog-Api-Key': key } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data as T;
}

async function download(url: string, file: string): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) return false;
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return true;
}

type Thumbs = Record<string, { url: string }>;
interface ApiVideo {
  id: string;
  snippet: { title: string; description: string; channelId: string; channelTitle: string; publishedAt: string; thumbnails: Thumbs };
  statistics: { viewCount?: string };
  contentDetails: { duration: string };
}

const key = apiKey();
const { items = [] } = await call<{ items?: ApiVideo[] }>(
  `videos?part=snippet,statistics,contentDetails&chart=mostPopular&maxResults=50&regionCode=${region}&hl=${lang}`,
  key,
);
// Shorts don't appear as regular cards.
const videos = items.filter((v) => parseIsoDuration(v.contentDetails.duration) > 60).slice(0, COUNT);
const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
const { items: channels = [] } = await call<{ items?: Array<{ id: string; snippet: { thumbnails: Thumbs } }> }>(
  `channels?part=snippet&maxResults=50&id=${channelIds.join(',')}`,
  key,
);

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const logos = new Map<string, string>();
for (const c of channels) {
  const t = c.snippet.thumbnails;
  const url = (t.medium ?? t.default)?.url;
  const file = `${OUT_DIR}/logo-${c.id}.jpg`;
  if (!url || !(await download(url, file))) continue;
  // Shown at 24–36 px: 96 px covers retina screens.
  execFileSync('sips', ['-Z', '96', '-s', 'format', 'jpeg', '-s', 'formatOptions', '75', file, '--out', file], { stdio: 'ignore' });
  logos.set(c.id, `feed/logo-${c.id}.jpg`);
}

const out = [];
for (const v of videos) {
  const t = v.snippet.thumbnails;
  const file = `${OUT_DIR}/${v.id}.jpg`;
  // maxres is 16:9 (standard/high are 4:3 with black bars); medium is the 16:9 fallback.
  if (!(await download((t.maxres ?? t.medium ?? t.default).url, file))) continue;
  execFileSync('sips', ['-z', '360', '640', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', file, '--out', file], { stdio: 'ignore' });
  out.push({
    id: v.id,
    title: v.snippet.title,
    description: (v.snippet.description.split('\n').find((l) => l.trim()) ?? '').slice(0, 200),
    channel: v.snippet.channelTitle,
    channelLogo: logos.get(v.snippet.channelId),
    views: Number(v.statistics.viewCount) || 0,
    duration: parseIsoDuration(v.contentDetails.duration),
    publishedAt: v.snippet.publishedAt,
    thumbnail: `feed/${v.id}.jpg`,
  });
}

mkdirSync('src/app/data', { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify({ region, fetchedAt: new Date().toISOString(), videos: out }, null, 2) + '\n');
const files = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).length : 0;
console.log(`${out.length} videos (${region}) → ${OUT_JSON}, ${files} images → ${OUT_DIR}/`);
