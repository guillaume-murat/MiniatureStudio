/**
 * Origin allowlist shared by our functions: only pages served from this
 * computer. Anything else is refused so the functions can't be used as a free
 * open proxy by other sites.
 */
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !!origin && LOCAL_ORIGIN.test(origin);
}

/**
 * Browsers send `Origin` on cross-origin requests and on same-origin POSTs, but
 * not on same-origin GETs; for those we fall back to `Sec-Fetch-Site`.
 */
export function isAllowedRequest(headers: Record<string, string | undefined>): boolean {
  const origin = headers.origin;
  if (origin) return isAllowedOrigin(origin);
  return headers['sec-fetch-site'] === 'same-origin';
}

export function corsHeaders(origin: string | undefined, methods: string, allowHeaders: string) {
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowHeaders,
    Vary: 'Origin',
  };
}
