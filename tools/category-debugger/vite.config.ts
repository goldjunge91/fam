import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // sql.js braucht SharedArrayBuffer-freundliche Isolation nicht zwingend,
  // aber Cross-Origin-Isolation schadet nicht und macht spätere WASM-Threads
  // moeglich, falls sql.js das mal nutzt.
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4174',
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
