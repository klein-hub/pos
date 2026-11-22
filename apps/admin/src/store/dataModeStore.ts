import { create } from 'zustand';
import {
  buildSeedCatalog,
  canSwitchDataMode,
  createLocalCatalogRepository,
  createSupabaseCatalogRepository,
  resolveInitialMode,
  type CatalogRepository,
  type DataMode,
} from '@digita/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useCatalogStore } from './catalogStore';

/** Seeded by 20261122130000_pos_demo_company. */
export const DEMO_COMPANY_ID = '11111111-2222-4333-8444-555555555555';

/**
 * The live POS company. Not simply the signed-in user's profile company: a
 * super admin's profile can point at an entirely different business (ours
 * points at Pristine Energy), and resolving "live" from the profile would
 * silently open a company with no POS data in it at all.
 */
export const LIVE_COMPANY_ID = '0e573ed8-ebe8-4e32-88aa-87100e838dab';

const STORAGE_KEY = 'digita.dataMode';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DataModeState {
  mode: DataMode;
  status: LoadStatus;
  error: string | null;
  canSwitch: boolean;
  /** True once a networked mode has loaded successfully in this session. */
  hasLoadedRemote: boolean;
  /** Set when a connection failure, rather than a choice, put us in local mode. */
  fellBackOffline: boolean;

  /** Called once auth has settled. Picks the starting mode and loads it. */
  start: () => Promise<void>;
  setMode: (mode: DataMode) => Promise<void>;
  reload: () => Promise<void>;
}

function readStored(): DataMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'local' || v === 'demo' || v === 'live' ? v : null;
  } catch {
    return null;
  }
}

function writeStored(mode: DataMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing and the like. A mode that does not persist across
    // reloads is a small annoyance; failing the switch would be worse.
  }
}

function companyIdFor(mode: DataMode): string {
  return mode === 'demo' ? DEMO_COMPANY_ID : LIVE_COMPANY_ID;
}

function repositoryFor(mode: DataMode): CatalogRepository {
  if (mode === 'local') return createLocalCatalogRepository(buildSeedCatalog);
  return createSupabaseCatalogRepository({ client: supabase, companyId: companyIdFor(mode) });
}

/**
 * A failed read is reported as a connection problem only when it really is
 * one. An empty catalog or a permission refusal must not masquerade as the
 * network being down, or the app would drop to offline sample data and tell
 * the user the wrong thing about why.
 */
function looksLikeConnectionFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|load failed|err_name_not_resolved|fetch failed/i.test(message);
}

export const useDataModeStore = create<DataModeState>((set, get) => ({
  mode: 'live',
  status: 'idle',
  error: null,
  canSwitch: false,
  hasLoadedRemote: false,
  fellBackOffline: false,

  start: async () => {
    const { user, activeCompanyId } = useAuthStore.getState();
    const canSwitch = canSwitchDataMode(user?.app_metadata as Record<string, unknown> | undefined);
    const mode = resolveInitialMode({
      stored: readStored(),
      canSwitch,
      profileCompanyId: activeCompanyId,
    });
    set({ canSwitch, mode });
    await load(mode, set, get, { allowFallback: true });
  },

  setMode: async (mode) => {
    if (!get().canSwitch) {
      set({ error: 'Only a super admin can change the data source.' });
      return;
    }
    writeStored(mode);
    set({ mode, fellBackOffline: false });
    // No fallback on a deliberate switch: someone who asked for live data and
    // cannot reach it needs to be told, not quietly handed sample data.
    await load(mode, set, get, { allowFallback: false });
  },

  reload: async () => {
    await load(get().mode, set, get, { allowFallback: false });
  },
}));

type Set = (partial: Partial<DataModeState>) => void;
type Get = () => DataModeState;

async function load(
  mode: DataMode,
  set: Set,
  get: Get,
  { allowFallback }: { allowFallback: boolean },
): Promise<void> {
  set({ status: 'loading', error: null });
  try {
    const catalog = await repositoryFor(mode).loadCatalog();

    if (mode !== 'local' && catalog.items.length === 0) {
      throw new Error(
        'That company has no catalog. Check the data source, or seed it before using this mode.',
      );
    }

    useCatalogStore.getState().replaceCatalog(catalog, mode);
    set({
      status: 'ready',
      error: null,
      hasLoadedRemote: mode === 'local' ? get().hasLoadedRemote : true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Falling back is for starting up with no connection — never for losing
    // one mid-session. After live data has loaded once, silently swapping it
    // for sample data would let someone keep working against figures that are
    // not the shop's and are not being kept.
    const mayFallBack =
      allowFallback && mode !== 'local' && !get().hasLoadedRemote && looksLikeConnectionFailure(error);

    if (mayFallBack) {
      useCatalogStore.getState().replaceCatalog(buildSeedCatalog(), 'local');
      set({ mode: 'local', status: 'ready', fellBackOffline: true, error: message });
      return;
    }

    set({ status: 'error', error: message });
  }
}
