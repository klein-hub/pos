/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Per-environment app locations; see packages/core/src/apps/registry.ts. */
  readonly VITE_APP_SALES_URL?: string;
  readonly VITE_APP_INVENTORY_URL?: string;
  readonly VITE_APP_POS_URL?: string;
  readonly VITE_APP_PAYROLL_URL?: string;
  /** Development convenience only; stripped from production builds. */
  readonly VITE_DEV_LOGIN_EMAIL?: string;
  readonly VITE_DEV_LOGIN_PASSWORD?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
