import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Local Vertex AI helper. The browser can't run gcloud, so the studio calls
 * `/vertex/*` on its own origin and this middleware adds an OAuth token from
 * `gcloud auth print-access-token` and the project from the gcloud config.
 *
 * Mounted by the Astro dev server (astro.config.mjs) and by the local server
 * of the macOS app (local/server.ts). Routes:
 *   GET  /vertex/status                               gcloud readiness
 *   POST /vertex/models/{model}:generateContent       relayed to Vertex AI
 *
 * With an `x-goog-api-key` header (Vertex express mode), the key is forwarded
 * instead and gcloud isn't needed.
 */

export type Run = (args: string[]) => Promise<string>;
type Next = (error?: unknown) => void;

export interface VertexOptions {
  /** Runs gcloud with these arguments and resolves with its trimmed stdout. */
  run?: Run;
  fetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

const MODEL_ROUTE = /^\/vertex\/models\/([\w.-]+):generateContent$/;
/** References are downscaled client-side, but a few 4K images still add up. */
const MAX_BODY_BYTES = 40_000_000;
/** gcloud tokens last an hour; refresh well before. */
const TOKEN_TTL_MS = 45 * 60_000;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** GUI apps get a minimal PATH; add the usual gcloud install locations. */
function gcloudPath(env: NodeJS.ProcessEnv): string {
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', `${homedir()}/google-cloud-sdk/bin`];
  return [env.PATH, ...extra].filter(Boolean).join(':');
}

export function defaultRun(env: NodeJS.ProcessEnv = process.env): Run {
  return (args) =>
    new Promise((resolve, reject) => {
      execFile(
        env.GCLOUD_PATH || 'gcloud',
        args,
        { env: { ...env, PATH: gcloudPath(env) }, timeout: 30_000 },
        (error, stdout, stderr) => {
          if (error) {
            const detail = stderr.trim().split('\n').pop() || error.message;
            reject(new Error((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'gcloud not found' : detail));
          } else resolve(stdout.trim());
        },
      );
    });
}

/** Vertex endpoint for a model. Express-mode keys use the project-less route. */
export function vertexUrl(opts: { model: string; project?: string; location: string; apiKey?: boolean }): string {
  const { model, project, location } = opts;
  if (opts.apiKey) return `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`;
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

/**
 * Only the studio served by this machine may spend the user's gcloud credentials:
 * the Host must be local (blocks DNS rebinding) and any Origin must be that same host.
 */
export function isLocalRequest(headers: IncomingMessage['headers']): boolean {
  const host = headers.host;
  if (!host || !LOCAL_HOST.test(host)) return false;
  const origin = headers.origin;
  return !origin || origin === `http://${host}`;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createVertexHandler(options: VertexOptions = {}) {
  const env = options.env ?? process.env;
  const run = options.run ?? defaultRun(env);
  const doFetch = options.fetch ?? fetch;
  const location = env.VERTEX_LOCATION || 'global';

  let token: { value: string; expires: number } | null = null;
  let project: Promise<string> | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expires > Date.now()) return token.value;
    const value = await run(['auth', 'print-access-token']);
    if (!value) throw new Error('gcloud returned no token (run: gcloud auth login)');
    token = { value, expires: Date.now() + TOKEN_TTL_MS };
    return value;
  }

  function getProject(): Promise<string> {
    const fromEnv = env.VERTEX_PROJECT || env.GOOGLE_CLOUD_PROJECT;
    if (fromEnv) return Promise.resolve(fromEnv);
    project ??= run(['config', 'get-value', 'project']).then((value) => {
      if (!value || value === '(unset)') throw new Error('no gcloud project (run: gcloud config set project <id>)');
      return value;
    });
    // Don't cache a failure: the user may fix their config while the app runs.
    project.catch(() => (project = null));
    return project;
  }

  async function status(res: ServerResponse): Promise<void> {
    try {
      const [p] = await Promise.all([getProject(), getToken()]);
      send(res, 200, { ok: true, project: p, location });
    } catch (error) {
      send(res, 200, { ok: false, error: (error as Error).message });
    }
  }

  async function relay(req: IncomingMessage, res: ServerResponse, model: string): Promise<void> {
    const apiKey = req.headers['x-goog-api-key'];
    const body = await readBody(req);
    const controller = new AbortController();
    // The studio's cancel button aborts its fetch; stop paying for the upstream call too.
    res.on('close', () => !res.writableFinished && controller.abort());

    const call = async (fresh: boolean) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let url: string;
      if (typeof apiKey === 'string' && apiKey) {
        headers['x-goog-api-key'] = apiKey;
        url = vertexUrl({ model, location, apiKey: true });
      } else {
        if (fresh) token = null;
        const [p, t] = await Promise.all([getProject(), getToken()]);
        headers.Authorization = `Bearer ${t}`;
        url = vertexUrl({ model, project: p, location });
      }
      return doFetch(url, { method: 'POST', headers, body: new Uint8Array(body), signal: controller.signal });
    };

    let upstream = await call(false);
    // Token revoked or expired early (e.g. after `gcloud auth login`): fetch a new one once.
    if (upstream.status === 401 && !apiKey) upstream = await call(true);
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  }

  return async function vertexMiddleware(req: IncomingMessage, res: ServerResponse, next?: Next): Promise<void> {
    const path = (req.url ?? '').split('?')[0];
    if (!path.startsWith('/vertex/')) return next?.();
    if (!isLocalRequest(req.headers)) return send(res, 403, { error: { message: 'Origin not allowed' } });

    try {
      if (path === '/vertex/status' && req.method === 'GET') return await status(res);
      const match = MODEL_ROUTE.exec(path);
      if (match && req.method === 'POST') return await relay(req, res, match[1]);
      send(res, 404, { error: { message: 'Unknown Vertex route' } });
    } catch (error) {
      if (res.headersSent) return void res.destroy();
      const status = (error as { status?: number }).status ?? (error instanceof Error && error.name === 'AbortError' ? 499 : 502);
      send(res, status, { error: { message: `Vertex helper: ${(error as Error).message}` } });
    }
  };
}
