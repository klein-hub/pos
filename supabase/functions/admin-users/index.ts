// =============================================================================
// admin-users — the only thing in the platform that needs the service role.
//
// Creating a sign-in (auth.admin.createUser) cannot be done from a browser,
// whatever the caller's role. Everything else — roles, app grants, licences —
// is ordinary table access governed by RLS and the RPCs in 20261124090000.
//
// Authorisation is checked here *as the caller*, by calling the database's own
// helpers with the caller's token, so this function and RLS cannot disagree
// about who is allowed to do what.
//
//   create_company   Digita admins. Company + licences + (optionally) owner.
//   create_user      Digita admins, or an owner/admin of the target company.
//   reset_password   Same as create_user, for someone already in the company.
// =============================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ??
  'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const APP_IDS = ['attendance', 'employee', 'expense', 'inventory', 'payroll', 'pos', 'sales'];
const COMPANY_ROLES = ['owner', 'admin', 'manager', 'user', 'viewer'];

function cors(origin: string | null): Record<string, string> {
  // Never "*": this function holds the service role.
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Readable, retypable, and long enough: 4 groups of 4 from an unambiguous alphabet. */
function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{4}/g)!.join('-');
}

function isPlatformAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  // app_metadata only — user_metadata is writable by the user themselves, so
  // trusting it would let anyone declare themselves a Digita admin.
  const role = user.app_metadata?.['role'];
  return typeof role === 'string' && role.replace(/\s+/g, '_').toLowerCase() === 'super_admin';
}

async function rpcBool(client: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new HttpError(500, `${fn}: ${error.message}`);
  return data === true;
}

async function licensedApps(admin: SupabaseClient, companyId: string): Promise<string[]> {
  const { data, error } = await admin.rpc('company_licensed_apps', { p_company_id: companyId });
  if (error) throw new HttpError(500, error.message);
  return (data ?? []) as string[];
}

interface NewUser {
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  apps?: string[];
  password?: string;
}

/** Create a sign-in, attach it to a company with a role, and grant apps. */
async function provisionUser(
  admin: SupabaseClient,
  companyId: string,
  input: NewUser,
): Promise<{ user_id: string; email: string; temporary_password: string | null }> {
  const email = input.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'A valid email is required');
  }
  const role = (input.role ?? 'user').toLowerCase();
  if (!COMPANY_ROLES.includes(role)) {
    throw new HttpError(400, `Role must be one of: ${COMPANY_ROLES.join(', ')}`);
  }

  const licensed = await licensedApps(admin, companyId);
  const apps = [...new Set(input.apps ?? [])];
  const unlicensed = apps.filter((a) => !licensed.includes(a));
  if (unlicensed.length) {
    throw new HttpError(400, `Not licensed for this company: ${unlicensed.join(', ')}`);
  }

  const generated = input.password ? null : temporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password ?? generated!,
    email_confirm: true,
    user_metadata: {
      display_name: [input.first_name, input.last_name].filter(Boolean).join(' ') || email,
      must_change_password: generated !== null,
    },
  });
  if (createError) {
    const taken = /already|registered|exists/i.test(createError.message);
    throw new HttpError(taken ? 409 : 400, taken ? 'That email already has an account' : createError.message);
  }
  const userId = created.user.id;

  // handle_new_user() has already inserted the profile row; shape it. The
  // service role has no auth.uid(), so profiles_guard_privileged lets it pass —
  // the authorisation that matters happened before we got here.
  const { data: roleRow } = await admin.from('roles').select('id').eq('name', role).maybeSingle();
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      company_id: companyId,
      role,
      role_id: roleRow?.id ?? null,
      first_name: input.first_name?.trim() || null,
      last_name: input.last_name?.trim() || null,
    })
    .eq('id', userId);
  if (profileError) {
    // Do not leave a sign-in with no company behind it.
    await admin.auth.admin.deleteUser(userId);
    throw new HttpError(500, `Could not attach the user to the company: ${profileError.message}`);
  }

  if (apps.length && role !== 'owner') {
    const { error: grantError } = await admin
      .from('app_access')
      .insert(apps.map((app_id) => ({ company_id: companyId, app_id, user_id: userId })));
    if (grantError) throw new HttpError(500, `User created, but app access failed: ${grantError.message}`);
  }

  return { user_id: userId, email, temporary_password: generated };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = { ...cors(origin), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });

  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Sign in first');

    // Two clients: one that acts as the caller (so RLS and the helpers see
    // them), one with the service role for the operations only it can do.
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: who, error: whoError } = await caller.auth.getUser(token);
    if (whoError || !who.user) throw new HttpError(401, 'Your session has expired — sign in again');
    const platform = isPlatformAdmin(who.user);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    if (action === 'create_company') {
      if (!platform) throw new HttpError(403, 'Only Digita admins can create companies');
      const c = body.company ?? {};
      const name = String(c.name ?? '').trim();
      if (!name) throw new HttpError(400, 'Company name is required');

      const apps = [...new Set((body.apps ?? []) as string[])].filter((a) => APP_IDS.includes(a));

      const { data: company, error: companyError } = await admin
        .from('companies')
        .insert({
          name,
          brand: String(c.brand ?? name).trim() || name,
          email: c.email || null,
          phone: c.phone || null,
          address: c.address || null,
          city: c.city || null,
          country: c.country || 'Philippines',
          currency: c.currency || 'PHP',
          timezone: c.timezone || 'Asia/Manila',
        })
        .select('id, name')
        .single();
      if (companyError) throw new HttpError(400, companyError.message);

      if (apps.length) {
        const { error } = await admin
          .from('company_apps')
          .insert(apps.map((app_id) => ({ company_id: company.id, app_id, status: 'active' })));
        if (error) throw new HttpError(500, `Company created, but licences failed: ${error.message}`);
      }

      let owner = null;
      if (body.owner?.email) {
        owner = await provisionUser(admin, company.id, { ...body.owner, role: 'owner' });
      }
      return new Response(JSON.stringify({ company, owner }), { status: 201, headers });
    }

    if (action === 'create_user' || action === 'reset_password') {
      const companyId = String(body.company_id ?? '');
      if (!companyId) throw new HttpError(400, 'company_id is required');

      const isAdmin = platform || (await rpcBool(caller, 'is_company_admin', { company_id: companyId }));
      if (!isAdmin) throw new HttpError(403, 'You are not an administrator of this company');

      if (action === 'create_user') {
        const role = String(body.user?.role ?? 'user').toLowerCase();
        if (role === 'owner' && !platform && !(await rpcBool(caller, 'is_company_owner', { company_id: companyId }))) {
          throw new HttpError(403, 'Only a company owner can create another owner');
        }
        const result = await provisionUser(admin, companyId, body.user ?? {});
        return new Response(JSON.stringify(result), { status: 201, headers });
      }

      // reset_password
      const userId = String(body.user_id ?? '');
      const { data: member } = await admin
        .from('profiles').select('id').eq('id', userId).eq('company_id', companyId).maybeSingle();
      if (!member) throw new HttpError(404, 'That person is not in this company');
      if (userId === who.user.id) throw new HttpError(400, 'Change your own password from your account settings');

      const password = temporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { must_change_password: true },
      });
      if (error) throw new HttpError(500, error.message);
      return new Response(JSON.stringify({ user_id: userId, temporary_password: password }), { headers });
    }

    throw new HttpError(400, `Unknown action "${action}"`);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
