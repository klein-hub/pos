import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { canSwitchDataMode, type HandoffSession } from '@digita/core';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  initialised: boolean;
  error: string | null;

  initialise: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** The tokens to hand to an app being opened, or null when signed out. */
  handoff: () => HandoffSession | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  displayName: null,
  isSuperAdmin: false,
  loading: false,
  initialised: false,
  error: null,

  initialise: async () => {
    set({ loading: true });
    try {
      const { data } = await supabase.auth.getSession();
      hydrate(set, data.session);
      supabase.auth.onAuthStateChange((_event, session) => hydrate(set, session));
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
      hydrate(set, data.session);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, displayName: null, isSuperAdmin: false });
  },

  handoff: () => {
    const { session } = get();
    if (!session?.access_token || !session?.refresh_token) return null;
    return { access_token: session.access_token, refresh_token: session.refresh_token };
  },
}));

type Setter = (partial: Partial<AuthState>) => void;

function hydrate(set: Setter, session: Session | null) {
  if (!session) {
    set({ user: null, session: null, displayName: null, isSuperAdmin: false });
    return;
  }
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  set({
    user: session.user,
    session,
    displayName:
      (typeof meta?.['display_name'] === 'string' ? meta['display_name'] : null) ??
      session.user.email ??
      null,
    isSuperAdmin: canSwitchDataMode(session.user.app_metadata as Record<string, unknown>),
  });
}
