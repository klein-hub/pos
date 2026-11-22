import { takeHandoffFromUrl as readFromUrl, type HandoffSession } from '@digita/core';

/**
 * Accepting a session handed over by the Digita app launcher.
 *
 * This file used to carry its own copy of the fragment-reading logic, kept in
 * step by hand, because payroll lived in a separate repository. Joining the
 * monorepo removes that duplication: the implementation now lives once, in
 * @digita/core.
 *
 * Core takes location and history as arguments rather than reaching for the
 * globals, so it stays free of DOM types for React Native. This wrapper
 * supplies the real ones.
 */
export const HUB_URL = import.meta.env.VITE_HUB_URL ?? 'http://localhost:5175';

export type { HandoffSession };

export function takeHandoffFromUrl(): HandoffSession | null {
  return readFromUrl(window.location, window.history);
}
