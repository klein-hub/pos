/**
 * Where the app's data comes from.
 *
 *   local  the in-memory seed. No network, nothing persists. The fallback when
 *          Supabase is unreachable, and the only mode that works offline.
 *   demo   Supabase, but a separate demo company. Real persistence, shared
 *          between viewers, safe to experiment in, resettable.
 *   live   Supabase, the real operating company.
 *
 * demo and live are kept apart by `company_id`, not by a flag on each row.
 * That matters: the tenant key already exists, every query already filters by
 * it, and RLS already enforces it — so demo data cannot leak into a live
 * report even if a query forgets to filter. An `is_demo` column on 23 tables
 * would put that guarantee in the hands of whoever writes the next query.
 */
export type DataMode = 'local' | 'demo' | 'live';

export const DATA_MODES: readonly DataMode[] = ['live', 'demo', 'local'];

export interface DataModeDescriptor {
  mode: DataMode;
  label: string;
  /** One line, shown in the switcher. */
  summary: string;
  /** Shown in the persistent banner when the mode is not `live`. */
  warning?: string;
  persists: boolean;
  needsNetwork: boolean;
}

export const DATA_MODE_INFO: Record<DataMode, DataModeDescriptor> = {
  live: {
    mode: 'live',
    label: 'Live',
    summary: 'The real shop. Sales, stock and costs are the operating record.',
    persists: true,
    needsNetwork: true,
  },
  demo: {
    mode: 'demo',
    label: 'Demo',
    summary: 'A separate demo company in the database. Safe to experiment in.',
    warning:
      'Demo data. Anything recorded here is kept, but it is not the shop’s real trading and will not appear in live reports.',
    persists: true,
    needsNetwork: true,
  },
  local: {
    mode: 'local',
    label: 'Offline sample',
    summary: 'Built-in sample catalog. Works with no database.',
    warning:
      'Offline sample data. Nothing you record here is saved — it is lost on refresh. Do not take a count or ring a sale in this mode.',
    persists: false,
    needsNetwork: false,
  },
};

/**
 * Switching data source is not a cosmetic preference: in the wrong mode a
 * cashier can ring real orders into data nobody keeps, or a manager can post a
 * stock count against the wrong company. Only a super admin may choose.
 *
 * This mirrors the database's own `is_super_admin()`, which reads the JWT
 * rather than `profiles.role` — so the UI gate and the RLS gate agree. A user
 * who slipped past this check would still be refused by RLS on the demo
 * company, which is the point of gating in both places.
 */
export function canSwitchDataMode(appMetadata: Record<string, unknown> | undefined): boolean {
  const role = appMetadata?.['role'] ?? appMetadata?.['user_role'];
  return typeof role === 'string' && role.replace(/\s+/g, '_').toLowerCase() === 'super_admin';
}

export interface ResolveModeInput {
  /** What the user last chose on this device, if anything. */
  stored: DataMode | null;
  /** Whether this user is allowed to choose at all. */
  canSwitch: boolean;
  /** The company the user's profile points at, if any. */
  profileCompanyId: string | null;
}

/**
 * The mode to start in.
 *
 * Defaults to `live`: a stored preference is honoured only for someone allowed
 * to switch, so a demo or offline choice cannot outlive the person who made it
 * and strand an ordinary user on data that is not real. A user with no company
 * has nothing live to read, so they start on the offline sample.
 */
export function resolveInitialMode({
  stored,
  canSwitch,
  profileCompanyId,
}: ResolveModeInput): DataMode {
  if (canSwitch && stored) return stored;
  if (!profileCompanyId) return 'local';
  return 'live';
}
