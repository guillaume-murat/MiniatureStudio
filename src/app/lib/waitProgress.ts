/** How long a call to the model usually takes. */
export const WAIT_MS = 30_000;

/** Where the bar stops filling evenly, at `WAIT_MS`. */
const EVEN_PART = 0.9;
/** What it never reaches before the image comes. */
const CEILING = 0.99;

/**
 * The waiting bar's fill, from 0 to 1, after `elapsedMs`: even up to 90 % at 30 seconds,
 * then ever slower towards 99 %, so a long call still moves without promising its end.
 */
export function waitProgress(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  if (t <= WAIT_MS) return (t / WAIT_MS) * EVEN_PART;
  return EVEN_PART + (CEILING - EVEN_PART) * (1 - Math.exp(-(t - WAIT_MS) / WAIT_MS));
}
