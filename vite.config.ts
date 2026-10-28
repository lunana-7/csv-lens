import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'development-react-preamble-csp',
      apply: 'serve',
      transformIndexHtml: (html) => html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';"),
    },
    {
      name: 'production-csp',
      apply: 'build',
      // Hot reload needs the loopback WebSocket; a deployed build must not allow it.
      transformIndexHtml: (html) => html.replace("connect-src 'self' ws://127.0.0.1:*;", "connect-src 'self';"),
    },
  ],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
