import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Handler, HandlerEvent } from '@netlify/functions';
import { handler as replicateProxy } from '../netlify/functions/replicate-proxy';
import { handler as youtubeProxy } from '../netlify/functions/youtube-thumbnail-proxy';
import { createVertexHandler, isLocalRequest } from './vertex';

/**
 * Serves the built site (dist/) on 127.0.0.1 with everything the studio needs
 * locally: the Vertex AI helper and the two Netlify functions. Used by the macOS
 * app and by `npm run local`.
 *
 *   NT_DIST   build directory (default: ./dist)
 *   NT_PORT   port (default: 17830; keep it stable, IndexedDB is tied to the origin)
 */

const DIST = resolve(process.env.NT_DIST || 'dist');
const PORT = Number(process.env.NT_PORT) || 17830;

// The functions only trust local origins in Netlify's dev context.
process.env.CONTEXT = 'dev';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

const FUNCTIONS: Record<string, Handler> = {
  '/.netlify/functions/replicate-proxy': replicateProxy,
  '/.netlify/functions/youtube-thumbnail-proxy': youtubeProxy,
};

const vertex = createVertexHandler();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function runFunction(fn: Handler, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));
  const event = {
    httpMethod: req.method ?? 'GET',
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: req.method === 'GET' || req.method === 'HEAD' ? null : await readBody(req),
    isBase64Encoded: false,
    path: url.pathname,
    rawUrl: url.href,
  } as unknown as HandlerEvent;
  const result = await (fn as (e: HandlerEvent) => Promise<{ statusCode: number; headers?: Record<string, string>; body?: string }>)(event);
  res.writeHead(result.statusCode, result.headers);
  res.end(result.body ?? '');
}

async function serveFile(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  let file = normalize(join(DIST, decodeURIComponent(pathname)));
  if (file !== DIST && !file.startsWith(DIST + sep)) return void res.writeHead(403).end();
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    if (!pathname.endsWith('/')) return void res.writeHead(301, { Location: `${pathname}/` }).end();
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return void res.end('Not found');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    if (url.pathname.startsWith('/vertex/')) return await vertex(req, res);
    const fn = FUNCTIONS[url.pathname];
    if (fn) {
      if (!isLocalRequest(req.headers)) return void res.writeHead(403).end();
      return await runFunction(fn, req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return void res.writeHead(405).end();
    await serveFile(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${PORT} is already in use.` : error);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NanoThumbnail ready on http://127.0.0.1:${PORT}/app/`);
});
