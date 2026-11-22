import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppId } from './registry.js';

/**
 * The access console's data calls.
 *
 * Reads and grant changes are RPCs that check the caller themselves
 * (20261124090000). Creating sign-ins needs the service role, so those go to
 * the admin-users Edge Function. Neither path trusts the UI: hiding a button
 * is presentation, the database is the rule.
 */

export type CompanyRole = 'owner' | 'admin' | 'manager' | 'user' | 'viewer';

export const COMPANY_ROLES: { id: CompanyRole; label: string; summary: string }[] = [
  { id: 'owner', label: 'Company Super Admin', summary: 'Everything the company licenses, plus managing its people.' },
  { id: 'admin', label: 'Admin', summary: 'Manages people and access. Cannot appoint owners.' },
  { id: 'manager', label: 'Manager', summary: 'Day-to-day operations in the apps granted.' },
  { id: 'user', label: 'Staff', summary: 'Uses the apps granted — usually the till.' },
  { id: 'viewer', label: 'Viewer', summary: 'Read-only, in the apps granted.' },
];

export function roleLabel(role: string): string {
  if (role === 'digita_admin') return 'Digita Admin';
  if (role === 'super_admin') return 'Admin (legacy)';
  return COMPANY_ROLES.find((r) => r.id === role)?.label ?? role;
}

export interface AdminCompany {
  id: string;
  name: string;
  brand: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
  members: number;
  licensed: AppId[];
}

export interface CompanyMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  lastSignInAt: string | null;
  apps: AppId[];
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? 'unknown error'}`);
}

export async function listCompanies(client: SupabaseClient): Promise<AdminCompany[]> {
  const { data, error } = await client.rpc('admin_companies');
  if (error) fail('Could not list companies', error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r['id'] as string,
    name: r['name'] as string,
    brand: (r['brand'] as string) ?? null,
    email: (r['email'] as string) ?? null,
    phone: (r['phone'] as string) ?? null,
    city: (r['city'] as string) ?? null,
    country: (r['country'] as string) ?? null,
    createdAt: r['created_at'] as string,
    members: Number(r['members'] ?? 0),
    licensed: (r['licensed'] as AppId[]) ?? [],
  }));
}

export async function listMembers(client: SupabaseClient, companyId: string): Promise<CompanyMember[]> {
  const { data, error } = await client.rpc('company_members', { p_company_id: companyId });
  if (error) fail('Could not list people', error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: r['user_id'] as string,
    email: r['email'] as string,
    firstName: (r['first_name'] as string) ?? null,
    lastName: (r['last_name'] as string) ?? null,
    role: r['role'] as string,
    lastSignInAt: (r['last_sign_in_at'] as string) ?? null,
    apps: (r['apps'] as AppId[]) ?? [],
  }));
}

export async function licensedAppsFor(client: SupabaseClient, companyId: string): Promise<AppId[]> {
  const { data, error } = await client.rpc('company_licensed_apps', { p_company_id: companyId });
  if (error) fail('Could not read licences', error);
  return (data ?? []) as AppId[];
}

export async function setMemberApps(client: SupabaseClient, companyId: string, userId: string, apps: AppId[]) {
  const { error } = await client.rpc('set_member_apps', { p_company_id: companyId, p_user_id: userId, p_apps: apps });
  if (error) fail('Could not update access', error);
}

export async function setMemberRole(client: SupabaseClient, companyId: string, userId: string, role: CompanyRole) {
  const { error } = await client.rpc('set_member_role', { p_company_id: companyId, p_user_id: userId, p_role: role });
  if (error) fail('Could not change role', error);
}

export async function removeMember(client: SupabaseClient, companyId: string, userId: string) {
  const { error } = await client.rpc('remove_member', { p_company_id: companyId, p_user_id: userId });
  if (error) fail('Could not remove', error);
}

export async function setCompanyLicenses(client: SupabaseClient, companyId: string, apps: AppId[]) {
  const { error } = await client.rpc('set_company_licenses', { p_company_id: companyId, p_apps: apps });
  if (error) fail('Could not update licences', error);
}

// --- Edge Function: anything that creates or resets a sign-in ---------------

async function invoke<T>(client: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.functions.invoke('admin-users', { body });
  if (error) {
    // supabase-js wraps non-2xx responses; the function's own message is in the body.
    let detail = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        detail = ((await context.json()) as { error?: string }).error ?? detail;
      } catch {
        /* keep the wrapper's message */
      }
    }
    if (/failed to send|not found|404/i.test(detail)) {
      detail = 'The admin-users function is not deployed yet. Run: supabase functions deploy admin-users';
    }
    throw new Error(detail);
  }
  return data as T;
}

export interface NewCompanyInput {
  company: {
    name: string;
    brand?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    currency?: string;
    timezone?: string;
  };
  apps: AppId[];
  owner?: { email: string; first_name?: string; last_name?: string };
}

export interface Provisioned {
  user_id: string;
  email: string;
  temporary_password: string | null;
}

export function createCompany(client: SupabaseClient, input: NewCompanyInput) {
  return invoke<{ company: { id: string; name: string }; owner: Provisioned | null }>(client, {
    action: 'create_company',
    ...input,
  });
}

export function createUser(
  client: SupabaseClient,
  companyId: string,
  user: { email: string; first_name?: string; last_name?: string; role: CompanyRole; apps: AppId[] },
) {
  return invoke<Provisioned>(client, { action: 'create_user', company_id: companyId, user });
}

export function resetPassword(client: SupabaseClient, companyId: string, userId: string) {
  return invoke<{ user_id: string; temporary_password: string }>(client, {
    action: 'reset_password',
    company_id: companyId,
    user_id: userId,
  });
}
