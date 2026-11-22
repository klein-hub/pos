import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppId, LaunchableApp } from './registry.js';

/**
 * Reading what the signed-in user may open.
 *
 * This is layer 2 and 3 of three. It decides what the UI shows and whether an
 * app lets you in — but it is not what protects the data. RLS is: a user
 * without inventory access gets no inventory rows however they arrive. If
 * these calls disagreed with the database, the database would win, which is
 * the right way round.
 */

/** Apps the caller may use in one company. */
export async function fetchMyApps(
  client: SupabaseClient,
  companyId: string,
): Promise<AppId[]> {
  const { data, error } = await client.rpc('my_app_access', { p_company_id: companyId });
  if (error) throw new Error(`Could not read app access: ${error.message}`);
  return (data ?? []) as AppId[];
}

export interface CompanyAccess {
  companyId: string;
  companyName: string;
  apps: AppId[];
}

/** Everything the caller can reach, across every company they belong to. */
export async function fetchAppAccessSummary(client: SupabaseClient): Promise<CompanyAccess[]> {
  const { data, error } = await client.rpc('my_app_access_summary');
  if (error) throw new Error(`Could not read app access: ${error.message}`);
  return ((data ?? []) as { company_id: string; company_name: string; apps: AppId[] }[]).map(
    (r) => ({ companyId: r.company_id, companyName: r.company_name, apps: r.apps ?? [] }),
  );
}

/**
 * Hide what the user cannot open.
 *
 * Cosmetic only, and deliberately so. A tile the user cannot use is noise, but
 * removing it protects nothing — they can still type the URL, which is why the
 * app itself checks on boot and the database checks every row.
 */
export function filterAppsByAccess(apps: LaunchableApp[], granted: readonly AppId[]): LaunchableApp[] {
  const allowed = new Set(granted);
  return apps.filter((a) => allowed.has(a.id));
}

export type AccessState =
  | { status: 'loading' }
  | { status: 'granted' }
  | { status: 'denied'; granted: AppId[] }
  | { status: 'error'; message: string };

/**
 * Whether this app should let the user in.
 *
 * `denied` carries what they *can* reach, so the refusal can point somewhere
 * useful instead of being a dead end.
 */
export function decideAccess(required: AppId, granted: AppId[]): AccessState {
  return granted.includes(required) ? { status: 'granted' } : { status: 'denied', granted };
}
