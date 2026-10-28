import { describe, expect, it } from 'vitest';
import { bannerUrl, channelPageUrl } from '../functions/youtube-channel';

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

describe('bannerUrl', () => {
  it('picks the largest desktop banner up to 2560 px', () => {
    const html =
      '"banner":{"imageBannerViewModel":{"image":{"sources":[' +
      '{"url":"https://yt3.googleusercontent.com/abc=w1060-fcrop64=1,0-k-nd-rj","width":1060,"height":175},' +
      '{"url":"https://yt3.googleusercontent.com/abc=w2120-fcrop64=1,0-k-nd-rj","width":2120,"height":351},' +
      '{"url":"https://yt3.googleusercontent.com/abc=w2560-fcrop64=1,0-k-nd-rj","width":2560,"height":424},' +
      '{"url":"https://yt3.googleusercontent.com/abc=w4000-fcrop64=1,0-k-nd-rj","width":4000,"height":662}]}}}';
    expect(bannerUrl(html)).toBe('https://yt3.googleusercontent.com/abc=w2560-fcrop64=1,0-k-nd-rj');
  });

  it('ignores channels without a banner and foreign hosts', () => {
    expect(bannerUrl('<html></html>')).toBeUndefined();
    expect(bannerUrl('"imageBannerViewModel":{"image":{"sources":[{"url":"https://evil.com/x.jpg","width":1060,"height":175}]')).toBeUndefined();
  });
});
