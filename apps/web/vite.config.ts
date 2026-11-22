import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The public marketing site. No Supabase, no auth — it only links out to the
// launcher for sign-in, so it can be served as plain static files.
export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  server: { port: 5176 },
});
