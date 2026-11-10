import { describe, expect, it } from 'vitest';
import { inMemory, isStoredImage, toStored } from '../blobStore';


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

describe('images kept as bytes in IndexedDB', () => {
  it('turns every image of a record into its bytes and type, leaving the rest as it is', async () => {
    const record = { id: 'p1', n: 3, at: new Date(0), inputs: { refs: [{ blob: new Blob(['ref'], { type: 'image/jpeg' }), use: 'style' }], name: 'x' }, blob: new Blob(['main'], { type: 'image/png' }) };
    const stored = await toStored(record);
    expect(stored.blob).not.toBeInstanceOf(Blob);
    expect(isStoredImage(stored.blob)).toBe(true);
    expect(isStoredImage(stored.inputs.refs[0].blob)).toBe(true);
    expect(stored.inputs.refs[0].use).toBe('style');
    expect(stored.n).toBe(3);
    expect(stored.at).toBeInstanceOf(Date);
  });

  it('gives the images back as Blobs with their bytes and type when read', async () => {
    const read = await inMemory(await toStored({ blob: new Blob(['main'], { type: 'image/png' }), list: [new Blob(['b'], { type: 'image/webp' })] }));
    expect(read.blob).toBeInstanceOf(Blob);
    expect(read.blob.type).toBe('image/png');
    expect(await read.blob.text()).toBe('main');
    expect(read.list[0].type).toBe('image/webp');
  });

  it('still reads the records saved before, with Blobs', async () => {
    const read = await inMemory({ blob: new Blob(['old'], { type: 'image/png' }) });
    expect(await read.blob.text()).toBe('old');
  });

  it('leaves raw bytes alone', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    expect(await toStored({ bytes })).toEqual({ bytes });
    expect((await inMemory({ bytes })).bytes).toBe(bytes);
  });
});
