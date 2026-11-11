import { dataUrlToBlob } from './images';
import type { ProjectStart } from './projectStart';

const ID_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/(?:embed|shorts|live)\/)([\w-]{11})/,
];

export function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  for (const p of ID_PATTERNS) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function fetchVideoTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.title === 'string' ? data.title : null;
  } catch {
    return null;
  }
}

/** maxresdefault doesn't exist for every video; YouTube serves a 120×90 grey placeholder instead of a 404. */
function isPlaceholder(blob: Blob): boolean {
  return blob.size < 2000;
}

export async function fetchThumbnail(videoId: string): Promise<Blob | null> {
  for (const quality of ['maxresdefault', 'sddefault', 'hqdefault']) {
    try {
      const res = await fetch(`https://i.ytimg.com/vi/${videoId}/${quality}.jpg`);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!isPlaceholder(blob)) return blob;
    } catch {
      break; // CORS/network: fall through to the proxy
    }
  }
  try {
    const res = await fetch(`/functions/youtube-thumbnail-proxy?videoId=${videoId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.base64 ? dataUrlToBlob(data.base64) : null;
  } catch {
    return null;
  }
}

/** Name, profile picture and banner of the channel behind a channel or video URL (through our function: youtube.com has no CORS). */
export async function fetchChannel(url: string): Promise<{ name: string; logo?: Blob; banner?: Blob } | null> {
  try {
    const res = await fetch(`/functions/youtube-channel?url=${encodeURIComponent(url.trim())}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; logo?: string; banner?: string };
    if (!data.name) return null;
    const [logo, banner] = await Promise.all([data.logo, data.banner].map((d) => (d ? dataUrlToBlob(d) : undefined)));
    return { name: data.name, logo, banner };
  } catch {
    return null;
  }
}

/**
 * What a YouTube URL brings to a new project: the channel behind it and, for a video, its title and
 * current thumbnail. Null when nothing could be read.
 */
export async function fetchProjectStart(url: string): Promise<ProjectStart | null> {
  const videoId = extractVideoId(url);
  const [channel, title, thumbnail] = await Promise.all([
    fetchChannel(url),
    videoId ? fetchVideoTitle(videoId) : null,
    videoId ? fetchThumbnail(videoId) : null,
  ]);
  const video = title || thumbnail ? { ...(title ? { title } : {}), ...(thumbnail ? { thumbnail } : {}) } : undefined;
  if (!channel && !video) return null;
  return { ...(channel ? { channel } : {}), ...(video ? { video } : {}) };
}
