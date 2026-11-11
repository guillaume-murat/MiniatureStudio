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
  slot?: 'front' | 'left' | 'right' | 'expression';
  expression?: string;
}

const FORMER_ORDER = { front: 0, left: 1, right: 2, expression: 3 } as const;

/**
 * A person's photos as the app uses them: plain photos (the former angles first: front, left,
 * right, then the expressions), at most 10, ticks kept and capped at 4; photos saved before ticks
 * existed get them in order.
 */
export function normalisePhotos(stored: StoredPersonaPhoto[]): PersonaPhoto[] {
  const ordered = stored
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => (FORMER_ORDER[a.photo.slot ?? 'expression'] - FORMER_ORDER[b.photo.slot ?? 'expression']) || a.index - b.index)
    .slice(0, MAX_PERSONA_PHOTOS);
  let ticked = 0;
  return ordered.map(({ photo }) => {
    const wanted = photo.used ?? true;
    const used = wanted && ticked < MAX_USED_PHOTOS;
    if (used) ticked++;
    return { id: photo.id, blob: photo.blob, used };
  });
}

/** The photos sent to the model. */
export function usedPhotos(photos: PersonaPhoto[]): PersonaPhoto[] {
  return photos.filter((p) => p.used);
}

/** Whether this photo's tick can be on: already ticked, or fewer than 4 are. */
export function canUse(photos: PersonaPhoto[], id: string): boolean {
  return photos.some((p) => p.id === id && p.used) || usedPhotos(photos).length < MAX_USED_PHOTOS;
}
