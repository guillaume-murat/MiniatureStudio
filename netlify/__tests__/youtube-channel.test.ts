import { describe, expect, it } from 'vitest';
import { channelPageUrl } from '../functions/youtube-channel';

describe('channelPageUrl', () => {
  it('keeps the channel part of a channel URL', async () => {
    expect(await channelPageUrl('https://www.youtube.com/@RickAstleyYT/videos')).toBe('https://www.youtube.com/@RickAstleyYT');
    expect(await channelPageUrl('youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw')).toBe('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw');
    expect(await channelPageUrl('https://m.youtube.com/c/SomeName')).toBe('https://www.youtube.com/c/SomeName');
  });

  it('refuses anything that is not YouTube', async () => {
    expect(await channelPageUrl('https://evil.com/@someone')).toBeNull();
    expect(await channelPageUrl('https://youtube.com.evil.com/@someone')).toBeNull();
    expect(await channelPageUrl('not a url at all')).toBeNull();
  });
});
