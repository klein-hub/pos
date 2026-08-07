import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /**
   * React Native must pass AsyncStorage; the web uses localStorage by default.
   * This is the only difference between the two apps' clients.
   */
  storage?: {
    getItem(key: string): Promise<string | null> | string | null;
    setItem(key: string, value: string): Promise<void> | void;
    removeItem(key: string): Promise<void> | void;
  };
  /** Deep-link session detection: true on web, false in React Native. */
  detectSessionInUrl?: boolean;
}

/**
 * One factory for both apps, so auth behaviour cannot drift between them.
 * Mirrors the payroll app's client configuration.
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (!config.url || !config.anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Copy .env.example and fill in the URL and anon key.',
    );
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: config.detectSessionInUrl ?? true,
      ...(config.storage ? { storage: config.storage } : {}),
    },
  });
}
