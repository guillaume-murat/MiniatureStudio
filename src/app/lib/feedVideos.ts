import data from '../data/feed-videos.json';

/**
 * Real YouTube videos for the feed preview, so the thumbnail is judged among
 * what viewers actually see. They ship with the app (src/app/data/feed-videos.json
 * and public/feed/), fetched by `npm run feed:update`: no key, no call at runtime.
 */

export interface FeedVideo {
  id: string;
  title: string;
  description: string;
  channel: string;
  /** Path under the site root, e.g. feed/logo-UC….jpg. */
  channelLogo?: string;
  views: number;
  /** Seconds. */
  duration: number;
  publishedAt: string;
  /** 640×360 JPEG, path under the site root, e.g. feed/abc123.jpg. */
  thumbnail: string;
}

interface FeedData {
  region: string;
  fetchedAt: string;
  videos: FeedVideo[];
}

export const FEED: FeedData = data as FeedData;

/** Bundled paths are relative to the build root. */
export function feedAsset(path: string | undefined): string | undefined {
  return path ? `${import.meta.env.BASE_URL}${path}` : undefined;
}

export { formatAgo, formatCount, formatDuration, parseIsoDuration, shuffled } from './feedFormat';
