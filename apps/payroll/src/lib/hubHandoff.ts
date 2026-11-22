/**
 * Accepting a session handed over by the Digita app launcher.
 *
 * The launcher and this app run on different ports, and a port is part of an
 * origin, so nothing in localStorage is shared between them. A user who has
 * just signed in at the hub would otherwise be asked to sign in again one
 * click later.
 *
 * The session arrives in the URL *fragment*: never sent to a server, never in
 * an access log, and stripped from the address bar on arrival. It does pass
 * through browser history, so this is a development-grade handoff, not a
 * substitute for a real identity provider once these are deployed apart.
 *
 * This duplicates packages/core/src/apps/handoff.ts in the digita-pos repo.
 * The two must stay in step: this app does not share that package, and the
 * alternative — publishing it — is not worth it for twenty lines while both
 * are still moving. Change one, change the other.
 */

export const HANDOFF_KEY = "digita_session";
export const HUB_URL = import.meta.env.VITE_HUB_URL ?? "http://localhost:5175";

export interface HandoffSession {
  access_token: string;
  refresh_token: string;
}

function decode(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Read a handed-over session from the current URL and remove it, so a copied
 * link or a reload cannot replay someone's tokens. Null when there is none.
 */
export function takeHandoffFromUrl(): HandoffSession | null {
  const { hash, pathname, search } = window.location;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const token = params.get(HANDOFF_KEY);
  if (!token) return null;

  // Strip it whatever happens next: a malformed token should not linger.
  params.delete(HANDOFF_KEY);
  const rest = params.toString();
  window.history.replaceState(
    null,
    "",
    `${pathname}${search}${rest ? `#${rest}` : ""}`,
  );

  try {
    const parsed = JSON.parse(decode(token)) as HandoffSession;
    if (
      typeof parsed.access_token !== "string" ||
      typeof parsed.refresh_token !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
