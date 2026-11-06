/**
 * WebKit (the macOS app) now and then refuses an image: "Error preparing Blob/File
 * data to be stored in object store". Its cause is unknown (it can't be reproduced
 * on demand); a model's result was paid for by then, so it gets a second chance.
 */
export function isBlobStoreError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'UnknownError' && error.message.includes('Blob/File');
}

/** Saves with `put`; if WebKit refuses the Blob, once more with a copy of its bytes held in memory. */
export async function putWithBlobRetry<T extends { blob: Blob }>(value: T, put: (value: T) => Promise<void>): Promise<void> {
  try {
    await put(value);
  } catch (error) {
    if (!isBlobStoreError(error)) throw error;
    const { blob } = value;
    await put({ ...value, blob: new Blob([await blob.arrayBuffer()], { type: blob.type }) });
  }
}

/**
 * WebKit hands IndexedDB images back as Blobs backed by its own files, and now and then
 * one can no longer be read later ("An error occured reading the Blob argument to
 * createImageBitmap"), cause unknown too. Records are read through this, so every image
 * the studio holds is a copy of its bytes in memory instead.
 */
export async function inMemory<T>(value: T): Promise<T> {
  if (value instanceof Blob) return new Blob([await value.arrayBuffer()], { type: value.type }) as T;
  if (Array.isArray(value)) return (await Promise.all(value.map((v) => inMemory(v)))) as T;
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await inMemory(v)] as const));
    return Object.fromEntries(entries) as T;
  }
  return value;
}
