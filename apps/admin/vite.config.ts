import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Without this, a missing .env produces a build that *looks* fine: Vite folds
 * the env vars to `undefined`, the client's guard clause becomes unconditional,
 * and Rollup dead-code-eliminates the entire Supabase client. You get a 65 kB
 * bundle instead of 284 kB and a white screen in production.
 */
function requireEnv(mode: string): Plugin {
  return {
    name: 'digita-require-env',
    config() {
      const env = loadEnv(mode, ROOT_ENV_DIR, 'VITE_');
      const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !env[k]);
      if (missing.length > 0) {
        throw new Error(
          `Missing ${missing.join(' and ')}. Copy .env.example to .env at the repo root and fill it in.`,
        );
      }
    },
  };
}

/** Both apps read one .env at the repo root, so the keys are set in a single place. */
const ROOT_ENV_DIR = '../../';

export default defineConfig(({ mode }) => ({
  plugins: [react(), requireEnv(mode)],
  envDir: ROOT_ENV_DIR,
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      output: {
        // Charts and the UI kit are large and change rarely — splitting them
        // keeps the app chunk small so day-to-day deploys invalidate less cache.
        manualChunks: {
          charts: ['recharts'],
          chakra: ['@chakra-ui/react', '@emotion/react', '@emotion/styled', 'framer-motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  optimizeDeps: {
    // @digita/core is consumed as TypeScript source from the workspace, so it
    // must not be pre-bundled — that keeps edits to the costing engine hot.
    exclude: ['@digita/core'],
  },
}));
