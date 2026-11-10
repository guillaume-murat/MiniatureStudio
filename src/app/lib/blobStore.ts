/** WebKit's refusal to store a Blob (records saved before images were kept as bytes). */
export function isBlobStoreError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'UnknownError' && error.message.includes('Blob/File');
}

/**
 * The images are kept in IndexedDB as their bytes, never as Blobs: WebKit (the macOS app)
 * now and then refuses to store a Blob ("Error preparing Blob/File data to be stored in
 * object store") and hands some back unreadable later ("An error occured reading the Blob
 * argument to createImageBitmap"), both because it keeps Blobs in files of its own. Bytes
 * (an ArrayBuffer) are stored in the database itself.
 */
export interface StoredImage {
  ntImage: ArrayBuffer;
  type: string;
}

export function isStoredImage(value: unknown): value is StoredImage {
  return !!value && typeof value === 'object' && (value as StoredImage).ntImage instanceof ArrayBuffer;
}

/** Plain objects and arrays are walked; anything else (bytes, dates) is kept as it is. */
function isPlain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** A record as it is written: every image in it becomes its bytes and type. */
export async function toStored<T>(value: T): Promise<T> {
  if (value instanceof Blob) return { ntImage: await value.arrayBuffer(), type: value.type } satisfies StoredImage as T;
  if (Array.isArray(value)) return (await Promise.all(value.map((v) => toStored(v)))) as T;
  if (isPlain(value)) {
    const entries = await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await toStored(v)] as const));
    return Object.fromEntries(entries) as T;
  }
  return value;
}

/**
 * A record as it is read: its images become Blobs again, held in memory. Records saved
 * before, with Blobs, still load: each of those is copied into memory too.
 */
export async function inMemory<T>(value: T): Promise<T> {
  if (isStoredImage(value)) return new Blob([value.ntImage], { type: value.type }) as T;
  if (value instanceof Blob) return new Blob([await value.arrayBuffer()], { type: value.type }) as T;
  if (Array.isArray(value)) return (await Promise.all(value.map((v) => inMemory(v)))) as T;
  if (isPlain(value)) {
    const entries = await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await inMemory(v)] as const));
    return Object.fromEntries(entries) as T;
  }
  return value;
}
