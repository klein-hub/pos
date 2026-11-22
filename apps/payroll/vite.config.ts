import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // One .env at the repo root serves every app in the workspace.
  envDir: '../../',
  // Pinned: the launcher links here by port, and the Express admin API's CORS
  // allow-list names it.
  server: { port: 5173 },
  optimizeDeps: {
    // @digita/core is consumed as TypeScript source from the workspace.
    exclude: ['lucide-react', '@digita/core'],
  },
});
