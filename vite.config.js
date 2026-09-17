import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Kettera Corp Portal — Vite config.
// Server port 5173 matches the CORS allowlist default in kettera_corp_api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
