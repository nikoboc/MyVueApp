import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // "@/..." resolves to "src/..." — see docs/05 §10 (modules & imports).
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
