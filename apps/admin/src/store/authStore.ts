import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  company_id: string | null;
  role: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Tenant key for every query in the app. Mirrors the payroll app. */
  activeCompanyId: string | null;
  loading: boolean;
  initialised: boolean;
  error: string | null;

  initialise: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  activeCompanyId: null,
  loading: false,
  initialised: false,
  error: null,

  initialise: async () => {
    set({ loading: true });
    try {
      const { data } = await supabase.auth.getSession();
      await hydrate(set, data.session);

      // Keep the store in step with token refreshes and sign-outs in other tabs.
      supabase.auth.onAuthStateChange((_event, session) => {
        void hydrate(set, session);
      });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false, initialised: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await hydrate(set, data.session);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null, activeCompanyId: null });
  },
}));

type Setter = (partial: Partial<AuthState>) => void;

async function hydrate(set: Setter, session: Session | null) {
  if (!session) {
    set({ user: null, session: null, profile: null, activeCompanyId: null });
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_id, role, first_name, last_name')
    .eq('id', session.user.id)
    .maybeSingle();

  set({
    user: session.user,
    session,
    profile: (profile as Profile) ?? null,
    activeCompanyId: profile?.company_id ?? null,
  });
}

/** Convenience for stores that must never query without a tenant. */
export function requireCompanyId(): string {
  const id = useAuthStore.getState().activeCompanyId;
  if (!id) throw new Error('No active company — sign in again or ask an admin to assign your company.');
  return id;
}
