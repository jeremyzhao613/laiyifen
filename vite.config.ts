import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['.trycloudflare.com', 'localhost'],
    proxy: {
      '/api': 'http://localhost:8788',
      '/uploads': 'http://localhost:8788',
    },
  },
});
