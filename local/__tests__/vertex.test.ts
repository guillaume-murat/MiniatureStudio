import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createVertexHandler, isLocalRequest, vertexUrl, type Run } from '../vertex';

function request(method: string, url: string, headers: Record<string, string> = {}, body = ''): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  Object.assign(req, { method, url, headers: { host: '127.0.0.1:17830', ...headers }, destroy: () => {} });
  queueMicrotask(() => {
    if (body) req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

function response() {
  const res = new EventEmitter() as ServerResponse & { status?: number; body?: string; headers?: Record<string, string> };
  Object.assign(res, {
    headersSent: false,
    writableFinished: false,
    writeHead(status: number, headers: Record<string, string>) {
      res.status = status;
      res.headers = headers;
      return res;
    },
    end(chunk?: Buffer | string) {
      res.body = chunk?.toString() ?? '';
    },
  });
  return res;
}

function gcloud(overrides: Partial<Record<'token' | 'project', string | Error>> = {}): Run {
  return vi.fn(async (args: string[]) => {
    const value = args[0] === 'auth' ? (overrides.token ?? 'ya29.token') : (overrides.project ?? 'my-project');
    if (value instanceof Error) throw value;
    return value;
  });
}

describe('vertexUrl', () => {
  it('targets the global endpoint with the project', () => {
    expect(vertexUrl({ model: 'gemini-3-pro-image', project: 'p', location: 'global' })).toBe(
      'https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-3-pro-image:generateContent',
    );
  });
  it('uses the regional host and the express-mode route', () => {
    expect(vertexUrl({ model: 'm', project: 'p', location: 'us-central1' })).toMatch(/^https:\/\/us-central1-aiplatform/);
    expect(vertexUrl({ model: 'm', location: 'global', apiKey: true })).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/m:generateContent',
    );
  });
});

describe('isLocalRequest', () => {
  it('accepts same-origin local requests', () => {
    expect(isLocalRequest({ host: '127.0.0.1:17830' })).toBe(true);
    expect(isLocalRequest({ host: 'localhost:4321', origin: 'http://localhost:4321' })).toBe(true);
  });
  it('refuses other sites and rebound hosts', () => {
    expect(isLocalRequest({ host: '127.0.0.1:17830', origin: 'https://evil.example' })).toBe(false);
    expect(isLocalRequest({ host: 'evil.example' })).toBe(false);
  });
});

describe('Vertex middleware', () => {
  it('passes other routes on', async () => {
    const next = vi.fn();
    await createVertexHandler({ run: gcloud() })(request('GET', '/app/'), response(), next);
    expect(next).toHaveBeenCalled();
  });

  it('reports gcloud status', async () => {
    const res = response();
    await createVertexHandler({ run: gcloud(), env: {} })(request('GET', '/vertex/status'), res);
    expect(JSON.parse(res.body!)).toEqual({ ok: true, project: 'my-project', location: 'global' });

    const broken = response();
    await createVertexHandler({ run: gcloud({ project: '(unset)' }), env: {} })(request('GET', '/vertex/status'), broken);
    expect(JSON.parse(broken.body!)).toMatchObject({ ok: false, error: expect.stringMatching(/project/) });
  });

  it('relays generateContent with the gcloud token and project', async () => {
    const fetch = vi.fn(async () => new Response('{"candidates":[]}', { headers: { 'content-type': 'application/json' } }));
    const res = response();
    const body = '{"contents":[]}';
    await createVertexHandler({ run: gcloud(), fetch, env: {} })(
      request('POST', '/vertex/models/gemini-3-pro-image:generateContent', { origin: 'http://127.0.0.1:17830' }, body),
      res,
    );
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"candidates":[]}');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain('/projects/my-project/locations/global/publishers/google/models/gemini-3-pro-image:generateContent');
    expect(init.headers.Authorization).toBe('Bearer ya29.token');
    expect(new TextDecoder().decode(init.body as Uint8Array)).toBe(body);
  });

  it('forwards an express-mode key instead of using gcloud', async () => {
    const run = gcloud();
    const fetch = vi.fn(async () => new Response('{}'));
    await createVertexHandler({ run, fetch, env: {} })(
      request('POST', '/vertex/models/m:generateContent', { 'x-goog-api-key': 'AQ.key' }, '{}'),
      response(),
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).not.toContain('/projects/');
    expect(init.headers['x-goog-api-key']).toBe('AQ.key');
    expect(run).not.toHaveBeenCalled();
  });

  it('refreshes the token once on 401', async () => {
    const run = gcloud();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const res = response();
    await createVertexHandler({ run, fetch, env: {} })(request('POST', '/vertex/models/m:generateContent', {}, '{}'), res);
    expect(res.status).toBe(200);
    expect((run as ReturnType<typeof vi.fn>).mock.calls.filter(([args]) => args[0] === 'auth')).toHaveLength(2);
  });

  it('refuses cross-site requests and unknown routes', async () => {
    const run = gcloud();
    const res = response();
    await createVertexHandler({ run })(request('POST', '/vertex/models/m:generateContent', { origin: 'https://evil.example' }), res);
    expect(res.status).toBe(403);
    expect(run).not.toHaveBeenCalled();

    const unknown = response();
    await createVertexHandler({ run })(request('POST', '/vertex/models/m:streamGenerateContent'), unknown);
    expect(unknown.status).toBe(404);
  });

  it('returns gcloud failures as JSON errors', async () => {
    const res = response();
    await createVertexHandler({ run: gcloud({ token: new Error('gcloud not found') }), env: {} })(
      request('POST', '/vertex/models/m:generateContent', {}, '{}'),
      res,
    );
    expect(res.status).toBe(502);
    expect(JSON.parse(res.body!).error.message).toMatch(/gcloud not found/);
  });
});
