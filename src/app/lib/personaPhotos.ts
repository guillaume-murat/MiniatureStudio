import type { PersonaPhoto } from './types';

/** How many photos a person keeps. */
export const MAX_PERSONA_PHOTOS = 10;
/** How many of them are ticked, and so sent to the model: enough for a faithful face, room for several people in one call. */
export const MAX_USED_PHOTOS = 4;

/** A photo as saved before: in an angle slot or as a labelled expression, with no tick. */
export interface StoredPersonaPhoto {
  id: string;
  blob: Blob;
  used?: boolean;
  /** Its place among the ticked photos, 1 to 4, in the order they were ticked. */
  rank?: number;
  slot?: 'front' | 'left' | 'right' | 'expression';
  expression?: string;
}

const FORMER_ORDER = { front: 0, left: 1, right: 2, expression: 3 } as const;

/**
 * A person's photos as the app uses them: plain photos (the former angles first: front, left,
 * right, then the expressions), at most 10. The ticked ones, at most 4, are numbered 1 to 4 in the
 * order they were ticked (photos ticked before the numbers existed, in grid order).
 */
export function normalisePhotos(stored: StoredPersonaPhoto[]): PersonaPhoto[] {
  const ordered = stored
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => (FORMER_ORDER[a.photo.slot ?? 'expression'] - FORMER_ORDER[b.photo.slot ?? 'expression']) || a.index - b.index)
    .slice(0, MAX_PERSONA_PHOTOS)
    .map(({ photo }, index) => ({ photo, index }));
  const ranked = ordered
    .filter(({ photo }) => photo.used ?? true)
    .sort((a, b) => (a.photo.rank ?? Infinity) - (b.photo.rank ?? Infinity) || a.index - b.index)
    .slice(0, MAX_USED_PHOTOS);
  const rankOf = new Map(ranked.map(({ photo }, i) => [photo.id, i + 1]));
  return ordered.map(({ photo }) => {
    const rank = rankOf.get(photo.id);
    return rank ? { id: photo.id, blob: photo.blob, used: true, rank } : { id: photo.id, blob: photo.blob, used: false };
  });
}

/** Ticks a photo (it comes last among the ticked ones) or unticks it (the ones after it move up). */
export function tick(photos: PersonaPhoto[], id: string, used: boolean): PersonaPhoto[] {
  const next = photos.map((p) => (p.id !== id ? p : used ? { ...p, used: true, rank: MAX_USED_PHOTOS + 1 } : { id: p.id, blob: p.blob, used: false }));
  return normalisePhotos(next);
}

/** The photos sent to the model, in the order they were ticked: the first matters most. */
export function usedPhotos(photos: PersonaPhoto[]): PersonaPhoto[] {
  return photos.filter((p) => p.used).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}

/** Whether this photo's tick can be on: already ticked, or fewer than 4 are. */
export function canUse(photos: PersonaPhoto[], id: string): boolean {
  return photos.some((p) => p.id === id && p.used) || usedPhotos(photos).length < MAX_USED_PHOTOS;
}

/** The person's thumbnail: the photo numbered 1, else the first one. */
export function coverPhoto(photos: PersonaPhoto[]): PersonaPhoto | undefined {
  return usedPhotos(photos)[0] ?? photos[0];
}
