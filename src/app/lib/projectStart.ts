import type { BrandKit, RefSource } from './types';

/** What a YouTube URL pasted in « Nouveau projet » brings: its channel, and for a video its title and current thumbnail. */
export interface ProjectStart {
  channel?: { name: string; logo?: Blob; banner?: Blob };
  video?: { title?: string; thumbnail?: Blob };
}

/** The new project's name: as typed, else the video's title, else the channel's name (undefined: the default name). */
export function startName(typed: string, start: ProjectStart | null): string | undefined {
  return typed.trim() || start?.video?.title || start?.channel?.name || undefined;
}

/** What the project starts with: the channel in its brand kit, the video's title in the brief, its thumbnail among the references. */
export function startInputs(start: ProjectStart | null): {
  brand: Partial<Pick<BrandKit, 'channelName' | 'logo' | 'banner'>>;
  videoTitle: string;
  refs: Array<{ blob: Blob; source: RefSource; label: string }>;
} {
  const channel = start?.channel;
  const video = start?.video;
  return {
    brand: channel ? { channelName: channel.name, ...(channel.logo ? { logo: channel.logo } : {}), ...(channel.banner ? { banner: channel.banner } : {}) } : {},
    videoTitle: video?.title ?? '',
    refs: video?.thumbnail ? [{ blob: video.thumbnail, source: 'youtube', label: video.title ? `YouTube: ${video.title}` : 'YouTube thumbnail' }] : [],
  };
}
