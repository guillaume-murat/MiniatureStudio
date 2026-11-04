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
