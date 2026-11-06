import { describe, expect, it } from 'vitest';
import { inMemory, isBlobStoreError, putWithBlobRetry } from '../blobStore';

const webkitError = () => new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
const item = () => ({ id: 'g1', blob: new Blob(['image'], { type: 'image/png' }) });

describe('saving an image in IndexedDB', () => {
  it('saves once when nothing goes wrong', async () => {
    const saved: unknown[] = [];
    const value = item();
    await putWithBlobRetry(value, async (v) => void saved.push(v));
    expect(saved).toEqual([value]);
  });

  it('tries again with a copy of the image when WebKit cannot prepare the Blob', async () => {
    const value = item();
    const tried: Array<typeof value> = [];
    await putWithBlobRetry(value, async (v) => {
      tried.push(v);
      if (tried.length === 1) throw webkitError();
    });
    expect(tried).toHaveLength(2);
    expect(tried[1].id).toBe('g1');
    expect(tried[1].blob).not.toBe(value.blob);
    expect(tried[1].blob.type).toBe('image/png');
    expect(await tried[1].blob.text()).toBe('image');
  });

  it('gives up after that second try', async () => {
    let tries = 0;
    await expect(
      putWithBlobRetry(item(), async () => {
        tries++;
        throw webkitError();
      }),
    ).rejects.toThrow('Error preparing Blob/File');
    expect(tries).toBe(2);
  });

  it('does not retry another failure, such as a full disk', async () => {
    let tries = 0;
    await expect(
      putWithBlobRetry(item(), async () => {
        tries++;
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }),
    ).rejects.toThrow('Quota exceeded');
    expect(tries).toBe(1);
  });

  it('recognises only that failure', () => {
    expect(isBlobStoreError(webkitError())).toBe(true);
    expect(isBlobStoreError(new DOMException('Quota exceeded', 'QuotaExceededError'))).toBe(false);
    expect(isBlobStoreError(new Error('Bad request'))).toBe(false);
  });
});

describe('reading records from IndexedDB', () => {
  it('replaces every image, however deep, with a copy of its bytes', async () => {
    const logo = new Blob(['logo'], { type: 'image/webp' });
    const photo = new Blob(['photo'], { type: 'image/png' });
    const record = { id: 'p1', name: 'Alex', brand: { logo }, photos: [{ slot: 'front', blob: photo }], tags: ['a'], empty: null };
    const copy = await inMemory(record);
    expect(copy).toEqual({ ...record, brand: { logo: expect.any(Blob) }, photos: [{ slot: 'front', blob: expect.any(Blob) }] });
    expect(copy.brand.logo).not.toBe(logo);
    expect(copy.brand.logo.type).toBe('image/webp');
    expect(await copy.brand.logo.text()).toBe('logo');
    expect(copy.photos[0].blob).not.toBe(photo);
    expect(await copy.photos[0].blob.text()).toBe('photo');
  });
});
