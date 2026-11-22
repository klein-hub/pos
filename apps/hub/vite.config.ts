import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // One .env at the repo root serves every app.
  envDir: '../../',
  server: { port: 5175 },
  optimizeDeps: { exclude: ['@digita/core'] },
});
