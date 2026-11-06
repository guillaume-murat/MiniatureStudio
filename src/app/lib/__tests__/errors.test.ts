import { describe, expect, it } from 'vitest';
import { errorLog, explainError } from '../errors';
import { ProviderError } from '../providers';

const err = (status: number, message = 'x') => new ProviderError(message, status, {}, 'replicate');

describe('explainError', () => {
  it('maps provider statuses to user-facing messages', () => {
    expect(explainError(err(401)).key).toBe('errors.auth');
    expect(explainError(err(402)).key).toBe('errors.credit');
    expect(explainError(err(429)).key).toBe('errors.rate');
    expect(explainError(err(413)).key).toBe('errors.tooLarge');
    expect(explainError(err(422, 'Prompt was flagged as sensitive')).key).toBe('errors.safety');
    expect(explainError(err(500)).key).toBe('errors.generic');
  });

  it('does not blame the key when our proxy refuses the origin', () => {
    expect(explainError(err(403, 'Origin not allowed')).key).toBe('errors.generic');
  });

  it('recognises timeouts, aborts and network errors', () => {
    expect(explainError(new DOMException('t', 'TimeoutError')).key).toBe('errors.timeout');
    expect(explainError(new DOMException('a', 'AbortError')).key).toBe('canvas.canceled');
    expect(explainError(new TypeError('Failed to fetch')).key).toBe('errors.network');
  });

  it('does not blame the provider when an image cannot be saved', () => {
    const error = new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
    expect(explainError(error).key).toBe('errors.storage');
  });

  it('does not blame the provider for an error in the studio itself', () => {
    expect(explainError(new DOMException('An error occured reading the Blob argument to createImageBitmap', 'InvalidStateError')).key).toBe('errors.local');
    expect(explainError(new Error('boom')).key).toBe('errors.local');
  });
});

describe('errorLog', () => {
  const context = {
    at: Date.UTC(2026, 10, 5, 20, 0, 0),
    step: 'prepare' as const,
    kind: 'region' as const,
    params: { provider: 'gemini' as const, model: 'nano-banana-2' as const, aspectRatio: '16:9' as const, resolution: '2K' as const, format: 'png' as const, safety: 'default' as never },
    images: [new Blob(['x'.repeat(2048)], { type: 'image/png' }), new Blob(['y'], { type: 'image/jpeg' })],
    promptLength: 812,
    elapsedMs: 4200,
    userAgent: 'TestAgent/1.0',
  };

  it('says where the job failed, with what, and the whole error', () => {
    const error = new DOMException('An error occured reading the Blob argument to createImageBitmap', 'InvalidStateError');
    const log = errorLog(error, context);
    expect(log).toContain('2026-11-05T20:00:00.000Z');
    expect(log).toContain('prepare');
    expect(log).toContain('region');
    expect(log).toContain('gemini');
    expect(log).toContain('nano-banana-2');
    expect(log).toContain('2K');
    expect(log).toContain('2 images');
    expect(log).toContain('1. image/png, 2.0 KB');
    expect(log).toContain('2. image/jpeg, 1 B');
    expect(log).toContain('812');
    expect(log).toContain('4.2 s');
    expect(log).toContain('TestAgent/1.0');
    expect(log).toContain('InvalidStateError');
    expect(log).toContain('An error occured reading the Blob argument to createImageBitmap');
  });

  it('includes the provider status and response, shortening long values and hiding the key', () => {
    const details = { error: { message: 'Too many images', code: 400 }, echo: 'data:image/png;base64,' + 'A'.repeat(5000), key: 'sk-secret-123' };
    const log = errorLog(new ProviderError('Too many images', 400, details, 'gemini'), { ...context, step: 'call', secret: 'sk-secret-123' });
    expect(log).toContain('HTTP 400');
    expect(log).toContain('Too many images');
    expect(log).toContain('"code": 400');
    expect(log).not.toContain('A'.repeat(1000));
    expect(log).not.toContain('sk-secret-123');
  });
});
