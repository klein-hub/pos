/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Where "Sign in" goes: the app launcher. */
  readonly VITE_HUB_URL?: string;
  /** Payment provider; unset means checkout explains payments are coming. */
  readonly VITE_PAYMENT_PROVIDER?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
