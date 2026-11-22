/**
 * Carrying a signed-in session from the launcher to the app it opens.
 *
 * The apps run on different ports, and a port is part of an origin, so
 * localhost:5175 and localhost:5174 have entirely separate localStorage. A
 * session in the hub simply does not exist in the app it links to — which is
 * why clicking through would otherwise land on a login screen every time.
 *
 * The session travels in the URL *fragment*. A fragment is never sent to a
 * server, never reaches an access log, and is stripped from the address bar on
 * arrival. It does still pass through browser history, so this is a
 * development-grade handoff: good enough for apps on one machine, not a
 * substitute for a real identity provider once these are deployed apart.
 */

export const HANDOFF_KEY = 'digita_session';

export interface HandoffSession {
  access_token: string;
  refresh_token: string;
}

/**
 * Structural stand-ins for the two browser objects this needs. Core has no
 * DOM lib on purpose — React Native consumes it too — so naming `Location`
 * and `History` directly would not compile.
 */
export interface UrlLocation {
  hash: string;
  pathname: string;
  search: string;
}
export interface UrlHistory {
  replaceState(data: unknown, unused: string, url: string): void;
}

/** base64url, so the value survives a URL without escaping. */
function encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Append a session to a destination URL. Returns the URL unchanged if there is none. */
export function withHandoff(href: string, session: HandoffSession | null): string {
  if (!session?.access_token || !session?.refresh_token) return href;
  const payload = encode(
    JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
  );
  const separator = href.includes('#') ? '&' : '#';
  return `${href}${separator}${HANDOFF_KEY}=${payload}`;
}

/**
 * Read a handed-over session from the current URL and remove it from the
 * address bar, so a copied link or a reload cannot replay someone's tokens.
 * Returns null when there is nothing to read.
 */
export function takeHandoffFromUrl(
  location: UrlLocation,
  history: UrlHistory,
): HandoffSession | null {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const raw = params.get(HANDOFF_KEY);
  if (!raw) return null;

  // Strip it whatever happens next: a malformed token should not linger either.
  params.delete(HANDOFF_KEY);
  const rest = params.toString();
  history.replaceState(null, '', `${location.pathname}${location.search}${rest ? `#${rest}` : ''}`);

  try {
    const parsed = JSON.parse(decode(raw)) as HandoffSession;
    if (typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
