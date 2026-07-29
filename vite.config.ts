import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sentryVitePlugin({ telemetry: false })],
  build: {
    sourcemap: true,
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/api/v2': 'http://localhost:8001',
      '/api': 'http://localhost:8000',
    },
  },
})
