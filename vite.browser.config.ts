/**
 * Vite config for browser-only dev mode.
 * Runs just the renderer without Electron, connecting to the dev server
 * via WebSocket for all backend operations (SQLite, PTY, etc).
 *
 * Usage: npx vite --config vite.browser.config.ts
 */
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: resolve('src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true
  }
})
