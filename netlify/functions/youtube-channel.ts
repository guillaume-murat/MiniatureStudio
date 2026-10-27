import type { Handler, HandlerEvent } from '@netlify/functions';
import { corsHeaders, isAllowedRequest } from '../lib/origin';

/**
 * Name and profile picture of a YouTube channel, from a channel URL or one of
 * its videos. The studio can't read youtube.com itself (no CORS): the channel
 * page's Open Graph tags give both, the picture is returned inline.
 */

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const IMAGE_HOSTS = /^yt3\.(googleusercontent|ggpht)\.com$/;
// The consent cookie skips the EU consent page that would replace the channel page.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  'Accept-Language': 'en',
  Cookie: 'SOCS=CAI; CONSENT=YES+',
};

/** The channel page URL for a channel or video URL, or null when it isn't a YouTube one. */
export async function channelPageUrl(input: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
  const channel = url.pathname.match(/^\/(@[\w.-]+|channel\/UC[\w-]{22}|c\/[\w.-]+|user\/[\w.-]+)/);
  if (channel) return `https://www.youtube.com${channel[0]}`;
  // A video: oEmbed names its channel.
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`);
  if (!res.ok) return null;
  const data = (await res.json()) as { author_url?: string };
  return data.author_url?.startsWith('https://www.youtube.com/') ? data.author_url : null;
}

function meta(html: string, property: string): string | undefined {
  const raw = html.match(new RegExp(`<meta property="og:${property}" content="([^"]*)"`))?.[1];
  return raw?.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export const handler: Handler = async (event: HandlerEvent) => {
  const cors = corsHeaders(event.headers.origin, 'GET, OPTIONS', 'Content-Type');
  const json = (statusCode: number, body: unknown) => ({ statusCode, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (!isAllowedRequest(event.headers)) return json(403, { error: 'Origin not allowed' });

  const input = event.queryStringParameters?.url?.trim();
  if (!input || input.length > 500) return json(400, { error: 'Missing url parameter' });

  try {
    const page = await channelPageUrl(input);
    if (!page) return json(404, { error: 'Not a YouTube channel or video URL' });
    const res = await fetch(page, { headers: HEADERS });
    if (!res.ok) return json(404, { error: 'Channel not found' });
    const html = await res.text();
    const name = meta(html, 'title');
    if (!name) return json(404, { error: 'Channel not found' });

    let logo: string | undefined;
    const image = meta(html, 'image');
    if (image && IMAGE_HOSTS.test(new URL(image).hostname)) {
      // 240 px is plenty for a channel picture.
      const img = await fetch(image.replace(/=s\d+-/, '=s240-'));
      if (img.ok) logo = `data:${img.headers.get('content-type') || 'image/jpeg'};base64,${Buffer.from(await img.arrayBuffer()).toString('base64')}`;
    }
    return json(200, { name, logo });
  } catch {
    return json(502, { error: 'YouTube unreachable' });
  }
};
