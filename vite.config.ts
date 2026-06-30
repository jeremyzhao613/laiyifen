import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const parseHosts = (raw = '') =>
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const tunnelHostSuffixes = parseHosts(process.env.VITE_TUNNEL_HOST_SUFFIXES)
  .filter((host) => host.startsWith('.'))
  .map((host) => host.toLowerCase());

const explicitAllowedHosts = parseHosts(process.env.VITE_ALLOWED_HOSTS);

const allowedHosts = Array.from(
  new Set([
    '.localhost',
    'localhost',
    '127.0.0.1',
    '::1',
    '.trycloudflare.com',
    '.cfargotunnel.com',
    ...tunnelHostSuffixes,
    ...explicitAllowedHosts,
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
    proxy: {
      '/api': 'http://127.0.0.1:8788',
      '/uploads': 'http://127.0.0.1:8788'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts,
  }
});
